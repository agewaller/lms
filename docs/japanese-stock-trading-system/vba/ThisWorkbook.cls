VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "ThisWorkbook"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = True
'===========================================================================
' ThisWorkbook (イベントモジュール)
'   - Workbook_Open で modMain.Startup 呼出
'   - Workbook_BeforeClose で modMain.Shutdown 呼出
'===========================================================================
Option Explicit

Private Sub Workbook_Open()
    On Error Resume Next
    modMain.Startup
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    On Error Resume Next
    modMain.Shutdown
End Sub

Private Sub Workbook_BeforeSave(ByVal SaveAsUI As Boolean, Cancel As Boolean)
    ' 名前付き保存は禁止
    If SaveAsUI Then
        MsgBox "このブックは名前を付けて保存できません", vbCritical
        Cancel = True
    End If
End Sub
