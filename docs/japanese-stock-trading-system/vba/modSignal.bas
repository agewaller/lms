Attribute VB_Name = "modSignal"
'===========================================================================
' modSignal - シグナル判定 / 戦略ディスパッチ / フィルタ
'===========================================================================
Option Explicit

Private mStrategies As Collection

'---------------------------------------------------------------------------
' RegisterStrategies : 有効化する戦略を Collection に登録
'---------------------------------------------------------------------------
Public Sub RegisterStrategies()
    Set mStrategies = New Collection
    Dim st As clsStrategyBreakout
    Set st = New clsStrategyBreakout
    mStrategies.Add st, st.Name
    ' 追加する時はここに Add するだけ
End Sub

'---------------------------------------------------------------------------
' ScanAll : 監視対象銘柄を全走査
'---------------------------------------------------------------------------
Public Sub ScanAll()
    On Error GoTo Fail
    If mStrategies Is Nothing Then RegisterStrategies

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("銘柄一覧")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

    Dim r As Long
    For r = 2 To lastRow
        Dim code As String
        code = CStr(ws.Cells(r, "A").Value)
        If Len(code) = 0 Then GoTo NextRow

        Dim watchOn As Boolean
        watchOn = CBool(ws.Cells(r, "D").Value)       ' 監視ON
        If Not watchOn Then GoTo NextRow

        Dim banned As Boolean
        banned = CBool(ws.Cells(r, "H").Value)        ' 売買禁止フラグ
        If banned Then GoTo NextRow

        EvaluateSymbol code
NextRow:
    Next r
    Exit Sub
Fail:
    modLog.ErrorLog "modSignal", "ScanAll", Err.Number, Err.Description, "", "ERROR"
End Sub

'---------------------------------------------------------------------------
' EvaluateSymbol : 1 銘柄を走査し、HIT があればシグナル生成
'---------------------------------------------------------------------------
Public Sub EvaluateSymbol(ByVal code As String)
    On Error GoTo Fail

    Dim ctx As clsSignalContext
    Set ctx = modRssData.BuildContext(code)
    If ctx Is Nothing Then Exit Sub

    ' フィルタ
    If Not PassFilters(ctx) Then Exit Sub

    Dim i As Long
    For i = 1 To mStrategies.Count
        Dim st As Object
        Set st = mStrategies.Item(i)
        Dim result As clsSignalResult
        Set result = st.Evaluate(ctx)
        If Not result Is Nothing Then
            If result.Hit Then
                CreateAndAppendSignal ctx, st.Name, result
                Exit For  ' 1 銘柄 1 シグナルまで
            End If
        End If
    Next i
    Exit Sub
Fail:
    modLog.ErrorLog "modSignal", "EvaluateSymbol", Err.Number, Err.Description, code, "WARN"
End Sub

'---------------------------------------------------------------------------
' PassFilters : 時間帯 / 流動性 / スプレッド / 重複発注 等
'---------------------------------------------------------------------------
Private Function PassFilters(ByRef ctx As clsSignalContext) As Boolean
    ' 時間帯
    If Not modUtils.IsMarketOpen(Now) Then PassFilters = False: Exit Function
    ' 流動性
    If ctx.Volume < modConfig.GetLong("cfgMinLiquidityVolume", 100000) Then
        PassFilters = False: Exit Function
    End If
    ' スプレッド
    Dim bps As Double
    bps = ctx.SpreadBps()
    If bps > modConfig.GetLong("cfgMaxSpreadBps", 50) Then
        PassFilters = False: Exit Function
    End If
    ' 重複発注禁止
    Dim existing As clsOrder
    Set existing = modOrder.FindOpenOrderBySymbol(ctx.Code)
    If Not existing Is Nothing Then PassFilters = False: Exit Function

    PassFilters = True
End Function

'---------------------------------------------------------------------------
' CreateAndAppendSignal : シグナルシートに追記
'---------------------------------------------------------------------------
Private Sub CreateAndAppendSignal(ByRef ctx As clsSignalContext, _
                                   ByVal strategyName As String, _
                                   ByRef result As clsSignalResult)
    Dim sigId As String
    sigId = modUtils.NewId("SIG")

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("シグナル")
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row + 1

    ws.Cells(r, 1).Value = sigId
    ws.Cells(r, 2).Value = Now
    ws.Cells(r, 3).Value = ctx.Code
    ws.Cells(r, 4).Value = ctx.Name
    ws.Cells(r, 5).Value = strategyName
    ws.Cells(r, 6).Value = result.Side
    ws.Cells(r, 7).Value = result.RefPrice
    ws.Cells(r, 8).Value = result.Qty
    ws.Cells(r, 9).Value = result.StopPrice
    ws.Cells(r, 10).Value = result.TakePrice
    ws.Cells(r, 11).Value = result.Reason

    ' リスクプレチェック
    Dim pre As String
    pre = modRisk.PreCheckSignal(sigId, ctx, result)
    If pre = "OK" Then
        ws.Cells(r, 12).Value = "OK"
        ws.Cells(r, 14).Value = "WAIT"
    Else
        ws.Cells(r, 12).Value = "NG"
        ws.Cells(r, 13).Value = pre
        ws.Cells(r, 14).Value = "REJECTED"
    End If
    ws.Cells(r, 18).Value = Now

    modLog.AppendSignal sigId, ctx.Code, strategyName, result.Side, _
                        result.RefPrice, result.Qty, result.Reason, _
                        ws.Cells(r, 14).Value

    If ws.Cells(r, 14).Value = "WAIT" Then
        modNotify.NotifyInfo "SIGNAL " & result.Side & " " & ctx.Code & _
                             " x" & result.Qty & " @" & result.RefPrice & _
                             " " & result.Reason
    End If
End Sub
