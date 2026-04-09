Attribute VB_Name = "modUI"
'===========================================================================
' modUI - ダッシュボード上のボタンから呼ばれるハンドラ
'===========================================================================
Option Explicit

'---------------------------------------------------------------------------
' btnEmergencyStop_Click : 緊急停止
'---------------------------------------------------------------------------
Public Sub btnEmergencyStop_Click()
    If MsgBox("緊急停止します。よろしいですか？", vbYesNo + vbExclamation, "緊急停止") <> vbYes Then Exit Sub
    modMain.EmergencyStop "MANUAL"
End Sub

'---------------------------------------------------------------------------
' btnResume_Click : 停止解除 (手動)
'---------------------------------------------------------------------------
Public Sub btnResume_Click()
    If MsgBox("停止状態を解除します。再発防止策は済んでいますか？", _
              vbYesNo + vbQuestion, "再開") <> vbYes Then Exit Sub
    modRisk.ResumeBy Environ("USERNAME")
End Sub

'---------------------------------------------------------------------------
' btnReloadConfig_Click : 設定再読込
'---------------------------------------------------------------------------
Public Sub btnReloadConfig_Click()
    modConfig.Refresh
    modLog.Info "SYSTEM", "ReloadConfig", Environ("USERNAME")
End Sub

'---------------------------------------------------------------------------
' btnApprove_Click : 選択中のシグナル行を承認し発注
'---------------------------------------------------------------------------
Public Sub btnApprove_Click()
    On Error GoTo Fail
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("シグナル")

    Dim r As Long
    r = ActiveCell.Row
    If r < 2 Then Exit Sub

    Dim state As String
    state = CStr(ws.Cells(r, 14).Value)
    If state <> "WAIT" Then
        MsgBox "承認待ち状態ではありません (state=" & state & ")", vbExclamation
        Exit Sub
    End If

    Dim sigId As String:  sigId = CStr(ws.Cells(r, 1).Value)
    Dim code As String:   code = CStr(ws.Cells(r, 3).Value)
    Dim side As String:   side = CStr(ws.Cells(r, 6).Value)
    Dim price As Double:  price = CDbl(ws.Cells(r, 7).Value)
    Dim qty As Long:      qty = CLng(ws.Cells(r, 8).Value)

    ' 2 秒ルール: 最低 2 秒は確認させる
    If MsgBox("【本当に発注しますか？】" & vbCrLf & _
              sigId & vbCrLf & _
              side & " " & code & " x" & qty & " @" & price, _
              vbYesNo + vbExclamation, "最終確認") <> vbYes Then Exit Sub

    Dim o As clsOrder
    Set o = modOrder.NewOrder(code, side, qty, price, "LIMIT", sigId)
    If modOrder.SendOrder(o) Then
        ws.Cells(r, 14).Value = "SENT"
        ws.Cells(r, 15).Value = Environ("USERNAME")
        ws.Cells(r, 16).Value = Now
        ws.Cells(r, 17).Value = o.OrderIdInternal
    Else
        ws.Cells(r, 14).Value = "ERROR"
    End If
    Exit Sub
Fail:
    modLog.ErrorLog "modUI", "btnApprove_Click", Err.Number, Err.Description, "", "ERROR"
    MsgBox "承認処理でエラー: " & Err.Description, vbCritical
End Sub

Public Sub btnReject_Click()
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("シグナル")
    Dim r As Long
    r = ActiveCell.Row
    If r < 2 Then Exit Sub
    ws.Cells(r, 14).Value = "REJECTED"
    ws.Cells(r, 15).Value = Environ("USERNAME")
    ws.Cells(r, 16).Value = Now
    modLog.Info "UI", "Reject", CStr(ws.Cells(r, 1).Value)
End Sub

Public Sub btnCancel_Click()
    On Error GoTo Fail
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("シグナル")
    Dim r As Long
    r = ActiveCell.Row
    If r < 2 Then Exit Sub
    Dim orderId As String
    orderId = CStr(ws.Cells(r, 17).Value)
    If Len(orderId) = 0 Then
        MsgBox "注文 ID がありません", vbExclamation
        Exit Sub
    End If
    If modOrder.CancelOrder(orderId) Then
        ws.Cells(r, 14).Value = "CANCEL"
    End If
    Exit Sub
Fail:
    modLog.ErrorLog "modUI", "btnCancel_Click", Err.Number, Err.Description, "", "ERROR"
End Sub
