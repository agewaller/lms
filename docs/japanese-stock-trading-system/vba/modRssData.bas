Attribute VB_Name = "modRssData"
'===========================================================================
' modRssData - RSS 関数で取得されたセルを読み、構造化データを返す
'
' ※ RSS 関数の正確な関数名と引数は要確認 (R1〜R13)
'   RSS_raw シートの列レイアウトはあらかじめ決めておき、ここは "セル読み" に徹する
'===========================================================================
Option Explicit

' RSS_raw シートの列レイアウト (想定)
Private Const COL_CODE As Long = 1
Private Const COL_NAME As Long = 2
Private Const COL_LAST As Long = 3
Private Const COL_CHG As Long = 4
Private Const COL_VOL As Long = 5
Private Const COL_OPEN As Long = 6
Private Const COL_HIGH As Long = 7
Private Const COL_LOW As Long = 8
Private Const COL_BID1 As Long = 9
Private Const COL_ASK1 As Long = 10
Private Const COL_VWAP As Long = 11
Private Const COL_TS As Long = 12  ' 最終更新時刻 (RSS の時刻)

Private Const HEARTBEAT_CELL As String = "A1"

'---------------------------------------------------------------------------
' ResetHeartbeat : 起動時に古い値を念のためクリア
'---------------------------------------------------------------------------
Public Sub ResetHeartbeat()
    ' RSS 関数が貼ってあるセルの内容はクリアしない
End Sub

'---------------------------------------------------------------------------
' GetHeartbeatAge : RSS の最終更新タイムスタンプから現在までの秒数
'   - セルが数値(日付)でなければ -1 を返す
'---------------------------------------------------------------------------
Public Function GetHeartbeatAge() As Long
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Worksheets("RSS_raw").Range(HEARTBEAT_CELL).Value
    If Not IsNumeric(v) Then GetHeartbeatAge = -1: Exit Function
    Dim sec As Double
    sec = (Now - CDate(v)) * 86400#
    GetHeartbeatAge = CLng(sec)
    Exit Function
Fail:
    GetHeartbeatAge = -1
End Function

Public Function IsRssStale() As Boolean
    Dim ageSec As Long
    ageSec = GetHeartbeatAge()
    IsRssStale = (ageSec < 0 Or ageSec > modConfig.GetLong("cfgRssHeartbeatMaxAgeSec", 10))
End Function

'---------------------------------------------------------------------------
' FindRow : RSS_raw シート内で銘柄コードの行を返す (キャッシュなしの単純 scan)
'---------------------------------------------------------------------------
Private Function FindRow(ByVal code As String) As Long
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("RSS_raw")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, COL_CODE).End(xlUp).Row
    Dim r As Long
    For r = 2 To lastRow
        If CStr(ws.Cells(r, COL_CODE).Value) = code Then
            FindRow = r
            Exit Function
        End If
    Next r
    FindRow = 0
End Function

'---------------------------------------------------------------------------
' BuildContext : 1 銘柄分のコンテキストを構築
'---------------------------------------------------------------------------
Public Function BuildContext(ByVal code As String) As clsSignalContext
    On Error GoTo Fail
    Dim r As Long
    r = FindRow(code)
    If r = 0 Then Exit Function

    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("RSS_raw")

    Dim ctx As clsSignalContext
    Set ctx = New clsSignalContext
    ctx.Code = code
    ctx.Name = CStr(ws.Cells(r, COL_NAME).Value)
    ctx.Last = CDbl(ws.Cells(r, COL_LAST).Value)
    ctx.Volume = CLng(ws.Cells(r, COL_VOL).Value)
    ctx.OpenPrice = CDbl(ws.Cells(r, COL_OPEN).Value)
    ctx.HighPrice = CDbl(ws.Cells(r, COL_HIGH).Value)
    ctx.LowPrice = CDbl(ws.Cells(r, COL_LOW).Value)
    ctx.Bid1 = CDbl(ws.Cells(r, COL_BID1).Value)
    ctx.Ask1 = CDbl(ws.Cells(r, COL_ASK1).Value)
    ctx.Vwap = CDbl(ws.Cells(r, COL_VWAP).Value)
    Set BuildContext = ctx
    Exit Function
Fail:
    Set BuildContext = Nothing
End Function

Public Function GetLastPrice(ByVal code As String) As Double
    Dim r As Long
    r = FindRow(code)
    If r = 0 Then GetLastPrice = 0: Exit Function
    GetLastPrice = CDbl(ThisWorkbook.Worksheets("RSS_raw").Cells(r, COL_LAST).Value)
End Function

'---------------------------------------------------------------------------
' GetCashBalance : 余力 (口座情報シートから)
'   ※ 実装は 要確認 R5 に従う
'---------------------------------------------------------------------------
Public Function GetCashBalance() As Long
    On Error GoTo Fail
    GetCashBalance = CLng(ThisWorkbook.Worksheets("RSS_account_raw").Range("B2").Value)
    Exit Function
Fail:
    GetCashBalance = 0
End Function

'---------------------------------------------------------------------------
' GetPositions : 保有建玉 (VBA コレクションで返す)
'---------------------------------------------------------------------------
Public Function GetPositions() As Collection
    Dim col As New Collection
    On Error GoTo Fail
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("RSS_account_raw")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "F").End(xlUp).Row  ' F 列 = コード想定
    Dim r As Long
    For r = 2 To lastRow
        Dim p As clsPosition
        Set p = New clsPosition
        p.Code = CStr(ws.Cells(r, "F").Value)
        p.Name = CStr(ws.Cells(r, "G").Value)
        p.Qty = CLng(ws.Cells(r, "H").Value)
        p.AvgPrice = CDbl(ws.Cells(r, "I").Value)
        p.LastPrice = CDbl(ws.Cells(r, "J").Value)
        col.Add p, p.Code
    Next r
Fail:
    Set GetPositions = col
End Function
