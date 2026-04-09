Attribute VB_Name = "modNotify"
'===========================================================================
' modNotify - Slack / Toast 通知と重複抑止
'===========================================================================
Option Explicit

Private mLastNotify As Object   ' Dictionary: key → last sent (Double)

Public Sub NotifyInfo(ByVal text As String)
    If Not modConfig.GetBool("cfgNotifyEnabled", True) Then Exit Sub
    If Dedupe(text, 30) Then Exit Sub
    PostSlackAsync text, "info"
    modLog.Info "NOTIFY", "Info", text
End Sub

Public Sub NotifyWarn(ByVal text As String)
    If Not modConfig.GetBool("cfgNotifyEnabled", True) Then Exit Sub
    If Dedupe(text, 15) Then Exit Sub
    PostSlackAsync text, "warn"
    modLog.Warn "NOTIFY", "Warn", text
End Sub

Public Sub NotifyError(ByVal text As String)
    If Dedupe(text, 10) Then Exit Sub
    PostSlackAsync text, "error"
End Sub

Public Sub NotifyFatal(ByVal text As String)
    ' FATAL は抑止しない
    PostSlackAsync text, "fatal"
End Sub

'---------------------------------------------------------------------------
' Dedupe : 同一テキストの連続通知を抑止
'---------------------------------------------------------------------------
Private Function Dedupe(ByVal key As String, ByVal periodSec As Long) As Boolean
    If mLastNotify Is Nothing Then Set mLastNotify = CreateObject("Scripting.Dictionary")
    Dim t As Double
    t = Timer
    If mLastNotify.Exists(key) Then
        If (t - CDbl(mLastNotify(key))) < periodSec Then
            Dedupe = True
            Exit Function
        End If
    End If
    mLastNotify(key) = t
    Dedupe = False
End Function

'---------------------------------------------------------------------------
' PostSlackAsync : Python notify_slack.py を Shell で起動（非ブロッキング）
'---------------------------------------------------------------------------
Public Sub PostSlackAsync(ByVal text As String, ByVal severity As String)
    On Error Resume Next
    Dim prefix As String
    If modConfig.TradingMode() = "PAPER" Then prefix = "[PAPER] " Else prefix = ""

    Dim py As String
    py = "pythonw.exe"
    Dim script As String
    script = "C:\Trading\python\notify_slack.py"
    Dim msg As String
    msg = Replace(prefix & text, """", "'")
    Dim cmd As String
    cmd = py & " """ & script & """ --severity " & severity & " """ & msg & """"
    Shell cmd, vbHide
End Sub
