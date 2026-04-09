Attribute VB_Name = "modLog"
'===========================================================================
' modLog - 追記専用ログ (売買ログ / エラーログ)
'
' すべて INSERT ONLY。既存行を書き換えない。
'===========================================================================
Option Explicit

Private mLogSeq As Long
Private mErrSeq As Long

'---------------------------------------------------------------------------
' Info / Warn : 売買ログへの追記
'---------------------------------------------------------------------------
Public Sub Info(ByVal kind As String, ByVal func_ As String, ByVal text As String)
    AppendTradeLog "INFO", kind, func_, text, "OK", ""
End Sub

Public Sub Warn(ByVal kind As String, ByVal func_ As String, ByVal text As String)
    AppendTradeLog "WARN", kind, func_, text, "WARN", ""
End Sub

Private Sub AppendTradeLog(ByVal severity As String, _
                            ByVal kind As String, _
                            ByVal func_ As String, _
                            ByVal text As String, _
                            ByVal result As String, _
                            ByVal reason As String)
    On Error GoTo Fail
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("売買ログ")
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row + 1
    mLogSeq = mLogSeq + 1
    ws.Cells(r, 1).Value = mLogSeq
    ws.Cells(r, 2).Value = Now
    ws.Cells(r, 3).Value = kind
    ws.Cells(r, 7).Value = func_ & " " & text
    ws.Cells(r, 8).Value = result
    ws.Cells(r, 9).Value = reason
    Exit Sub
Fail:
    ' ログ書込失敗 → _meta に記録して 2 回連続なら停止
    Dim failCnt As Long
    failCnt = modConfig.GetLong("stateLogFailCount", 0) + 1
    On Error Resume Next
    ThisWorkbook.Names("stateLogFailCount").RefersToRange.Value = failCnt
    If failCnt >= 2 Then modRisk.Halt "LOG_WRITE_FAIL"
End Sub

'---------------------------------------------------------------------------
' ErrorLog : エラーログへの追記
'---------------------------------------------------------------------------
Public Sub ErrorLog(ByVal module_ As String, _
                     ByVal func_ As String, _
                     ByVal errNo As Long, _
                     ByVal errDesc As String, _
                     ByVal ctx As String, _
                     ByVal severity As String)
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("エラーログ")
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row + 1
    mErrSeq = mErrSeq + 1
    ws.Cells(r, 1).Value = mErrSeq
    ws.Cells(r, 2).Value = Now
    ws.Cells(r, 3).Value = module_
    ws.Cells(r, 4).Value = func_
    ws.Cells(r, 5).Value = errNo
    ws.Cells(r, 6).Value = errDesc
    ws.Cells(r, 7).Value = ctx
    ws.Cells(r, 8).Value = severity
    ws.Cells(r, 9).Value = IIf(severity = "FATAL", "自動停止", "通知のみ")
End Sub

Public Function ErrorCountToday() As Long
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("エラーログ")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    Dim r As Long, n As Long
    For r = 2 To lastRow
        If DateValue(ws.Cells(r, 2).Value) = Date Then n = n + 1
    Next r
    ErrorCountToday = n
End Function

'---------------------------------------------------------------------------
' AppendSignal : シグナル発生ログ（売買ログ種別=SIGNAL）
'---------------------------------------------------------------------------
Public Sub AppendSignal(ByVal sigId As String, _
                         ByVal code As String, _
                         ByVal strategyName As String, _
                         ByVal side As String, _
                         ByVal price As Double, _
                         ByVal qty As Long, _
                         ByVal reason As String, _
                         ByVal state As String)
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("売買ログ")
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row + 1
    mLogSeq = mLogSeq + 1
    ws.Cells(r, 1).Value = mLogSeq
    ws.Cells(r, 2).Value = Now
    ws.Cells(r, 3).Value = "SIGNAL"
    ws.Cells(r, 4).Value = sigId
    ws.Cells(r, 6).Value = code
    ws.Cells(r, 7).Value = strategyName & " " & side & " x" & qty & " @" & price & " " & reason
    ws.Cells(r, 8).Value = state
End Sub
