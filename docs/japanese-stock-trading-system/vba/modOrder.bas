Attribute VB_Name = "modOrder"
'===========================================================================
' modOrder - 発注 / 取消 / 注文ロック / 注文管理シート CRUD
'
' 発注関数の実体は MS2 RSS の仕様（要確認 R2, R6, R7, R8）。
' この雛形では SendOrderLive は stub（FATAL を返す）にしておく。
' LIVE で動かすには RSS_VERIFIED.md に沿って実装する。
'===========================================================================
Option Explicit

Private mOrderLock As Boolean
Private mLastOrderTick As Double

'---------------------------------------------------------------------------
' AcquireOrderLock : モジュール単位の排他ロック
'---------------------------------------------------------------------------
Public Function AcquireOrderLock() As Boolean
    If mOrderLock Then
        AcquireOrderLock = False
        Exit Function
    End If
    mOrderLock = True
    AcquireOrderLock = True
End Function

Public Sub ReleaseOrderLock()
    mOrderLock = False
End Sub

'---------------------------------------------------------------------------
' CheckOrderInterval : 二重クリック防止（経過ミリ秒チェック）
'---------------------------------------------------------------------------
Public Function CheckOrderInterval() As Boolean
    Dim nowTick As Double
    nowTick = Timer  ' 秒精度（環境により ms）
    Dim minMs As Long
    minMs = modConfig.GetLong("cfgMinTickInterval", 500)
    If (nowTick - mLastOrderTick) * 1000 < minMs Then
        CheckOrderInterval = False
    Else
        CheckOrderInterval = True
    End If
End Function

'---------------------------------------------------------------------------
' NewOrder : 内部注文オブジェクトを生成（まだ送信しない）
'---------------------------------------------------------------------------
Public Function NewOrder(ByVal code As String, _
                          ByVal side As String, _
                          ByVal qty As Long, _
                          ByVal price As Double, _
                          ByVal orderType As String, _
                          ByVal sigId As String) As clsOrder
    Dim o As clsOrder
    Set o = New clsOrder
    o.OrderIdInternal = modUtils.NewId("ORD")
    o.SignalId = sigId
    o.Code = code
    o.Side = side
    o.Qty = qty
    o.Price = price
    o.OrderType = orderType
    o.State = "NEW"
    o.CreatedAt = Now
    Set NewOrder = o
End Function

'---------------------------------------------------------------------------
' SendOrder : 発注のメインエントリ
'    - PreCheckOrder → AcquireLock → Append → Send → Record → Release
'---------------------------------------------------------------------------
Public Function SendOrder(ByRef o As clsOrder) As Boolean
    On Error GoTo Fail

    ' 1) Pre-check
    Dim check As String
    check = modRisk.PreCheckOrder(o)
    If check <> "OK" Then
        modLog.Warn "ORDER", "SendOrder", "REJECT " & o.OrderIdInternal & " " & check
        modNotify.NotifyWarn "REJECT " & o.Code & " " & check
        o.State = "REJECT"
        o.ErrorCode = check
        AppendOrderRow o
        SendOrder = False
        Exit Function
    End If

    ' 2) Lock
    If Not AcquireOrderLock() Then
        modLog.Warn "ORDER", "SendOrder", "LOCK_HELD " & o.OrderIdInternal
        SendOrder = False
        Exit Function
    End If

    ' 3) Append NEW row
    AppendOrderRow o
    modLog.Info "ORDER", "SendOrder", "ATTEMPT " & o.OrderIdInternal & " " & o.Code & _
                                        " " & o.Side & " x" & o.Qty & " @" & o.Price

    ' 4) Dispatch by trading mode
    Dim ok As Boolean
    Select Case modConfig.TradingMode()
        Case "PAPER"
            ok = SimulateOrder(o)
        Case "LIVE"
            ok = SendOrderLive(o)
        Case "OBSERVE"
            ok = False
            o.State = "REJECT"
            o.ErrorCode = "OBSERVE_MODE"
    End Select

    ' 5) Record
    mLastOrderTick = Timer
    UpdateOrderRow o

    ' 6) Increment daily counter
    On Error Resume Next
    ThisWorkbook.Names("stateTodayOrders").RefersToRange.Value = _
        modConfig.GetLong("stateTodayOrders", 0) + 1
    On Error GoTo 0

    ' 7) Notify & log
    If ok Then
        modLog.Info "ORDER", "SendOrder", "SENT " & o.OrderIdInternal
        modNotify.NotifyInfo "SENT " & o.Code & " " & o.Side & " x" & o.Qty & " @" & o.Price
    Else
        modLog.Warn "ORDER", "SendOrder", "FAIL " & o.OrderIdInternal & " " & o.ErrorCode
        modNotify.NotifyWarn "ORDER_FAIL " & o.Code & " " & o.ErrorCode
    End If

    ReleaseOrderLock
    SendOrder = ok
    Exit Function

Fail:
    modLog.ErrorLog "modOrder", "SendOrder", Err.Number, Err.Description, o.OrderIdInternal, "FATAL"
    modNotify.NotifyFatal "SendOrder exception: " & Err.Description
    ReleaseOrderLock
    SendOrder = False
End Function

'---------------------------------------------------------------------------
' SimulateOrder : PAPER モード用の擬似発注
'---------------------------------------------------------------------------
Private Function SimulateOrder(ByRef o As clsOrder) As Boolean
    o.OrderIdExternal = "SIM-" & o.OrderIdInternal
    o.State = "SENT"
    ' ランダム約定は modPosition.SimTick 側で処理
    SimulateOrder = True
End Function

'---------------------------------------------------------------------------
' SendOrderLive : 実発注（RSS 発注関数を呼ぶ）
'   ※ MS2 RSS の関数名と引数は要確認 (R2/R6/R7)
'   ※ 未実装の間は必ず FATAL を返して停止させる
'---------------------------------------------------------------------------
Private Function SendOrderLive(ByRef o As clsOrder) As Boolean
    ' TODO: RSS_VERIFIED.md の発注関数仕様に従って実装する
    o.State = "ERROR"
    o.ErrorCode = "NOT_IMPLEMENTED_LIVE"
    modRisk.Halt "LIVE_ORDER_NOT_IMPLEMENTED"
    SendOrderLive = False
End Function

'---------------------------------------------------------------------------
' CancelOrder : 取消
'---------------------------------------------------------------------------
Public Function CancelOrder(ByVal orderIdInternal As String) As Boolean
    On Error GoTo Fail
    Dim o As clsOrder
    Set o = FindOrderById(orderIdInternal)
    If o Is Nothing Then CancelOrder = False: Exit Function

    Select Case modConfig.TradingMode()
        Case "PAPER"
            o.State = "CANCEL"
        Case "LIVE"
            ' TODO: RSS 取消関数（要確認）
            o.State = "CANCEL"  ' stub
        Case "OBSERVE"
            o.State = "CANCEL"
    End Select
    UpdateOrderRow o
    modLog.Info "ORDER", "CancelOrder", "CANCEL " & orderIdInternal
    modNotify.NotifyInfo "CANCEL " & o.Code & " " & orderIdInternal
    CancelOrder = True
    Exit Function
Fail:
    modLog.ErrorLog "modOrder", "CancelOrder", Err.Number, Err.Description, orderIdInternal, "ERROR"
    CancelOrder = False
End Function

'---------------------------------------------------------------------------
' FindOpenOrderBySymbol : 未約定の同一銘柄注文を探す
'---------------------------------------------------------------------------
Public Function FindOpenOrderBySymbol(ByVal code As String) As clsOrder
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("注文管理")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    Dim r As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, "E").Value) = code Then
            Dim state As String
            state = CStr(ws.Cells(r, "N").Value)
            If state = "NEW" Or state = "SENT" Or state = "PART" Then
                Set FindOpenOrderBySymbol = RowToOrder(ws, r)
                Exit Function
            End If
        End If
    Next r
    Set FindOpenOrderBySymbol = Nothing
End Function

Public Function FindOrderById(ByVal orderIdInternal As String) As clsOrder
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("注文管理")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    Dim r As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, "A").Value) = orderIdInternal Then
            Set FindOrderById = RowToOrder(ws, r)
            Exit Function
        End If
    Next r
    Set FindOrderById = Nothing
End Function

Private Function RowToOrder(ByRef ws As Worksheet, ByVal r As Long) As clsOrder
    Dim o As clsOrder
    Set o = New clsOrder
    o.OrderIdInternal = CStr(ws.Cells(r, "A").Value)
    o.OrderIdExternal = CStr(ws.Cells(r, "B").Value)
    o.SignalId = CStr(ws.Cells(r, "C").Value)
    o.Code = CStr(ws.Cells(r, "E").Value)
    o.Side = CStr(ws.Cells(r, "F").Value)
    o.Qty = CLng(ws.Cells(r, "G").Value)
    o.OrderType = CStr(ws.Cells(r, "H").Value)
    o.Price = CDbl(ws.Cells(r, "I").Value)
    o.State = CStr(ws.Cells(r, "N").Value)
    Set RowToOrder = o
End Function

Private Sub AppendOrderRow(ByRef o As clsOrder)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("注文管理")
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row + 1
    ws.Cells(r, "A").Value = o.OrderIdInternal
    ws.Cells(r, "B").Value = o.OrderIdExternal
    ws.Cells(r, "C").Value = o.SignalId
    ws.Cells(r, "D").Value = Now
    ws.Cells(r, "E").Value = o.Code
    ws.Cells(r, "F").Value = o.Side
    ws.Cells(r, "G").Value = o.Qty
    ws.Cells(r, "H").Value = o.OrderType
    ws.Cells(r, "I").Value = o.Price
    ws.Cells(r, "J").Value = "当日"
    ws.Cells(r, "K").Value = "特定"  ' 口座区分（要確認）
    ws.Cells(r, "N").Value = o.State
End Sub

Private Sub UpdateOrderRow(ByRef o As clsOrder)
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("注文管理")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    Dim r As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, "A").Value) = o.OrderIdInternal Then
            ws.Cells(r, "B").Value = o.OrderIdExternal
            ws.Cells(r, "L").Value = IIf(o.State = "ERROR" Or o.State = "REJECT", "NG", "OK")
            ws.Cells(r, "M").Value = o.ErrorCode
            ws.Cells(r, "N").Value = o.State
            Exit Sub
        End If
    Next r
End Sub
