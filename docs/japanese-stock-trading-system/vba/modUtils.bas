Attribute VB_Name = "modUtils"
'===========================================================================
' modUtils - 汎用ユーティリティ (ID採番 / 時刻 / 安全読込)
'===========================================================================
Option Explicit

'---------------------------------------------------------------------------
' NewId : 種別別の連番 ID を発行
'---------------------------------------------------------------------------
Public Function NewId(ByVal kind As String) As String
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("_meta")
    Dim rng As Range
    Select Case kind
        Case "SIG":  Set rng = ws.Range("D2")
        Case "ORD":  Set rng = ws.Range("D3")
        Case "POS":  Set rng = ws.Range("D4")
        Case Else
            NewId = kind & "-" & Format(Now, "yyyymmddhhnnss")
            Exit Function
    End Select

    Dim dayCell As Range
    Set dayCell = rng.Offset(0, 1)    ' E列 = 最終日付
    If DateValue(CStr(dayCell.Value)) <> Date Then
        dayCell.Value = Format(Date, "yyyy-mm-dd")
        rng.Value = 0
    End If
    rng.Value = CLng(rng.Value) + 1
    NewId = kind & "-" & Format(Date, "yyyymmdd") & "-" & Format(rng.Value, "0000")
End Function

'---------------------------------------------------------------------------
' IsMarketOpen : ザラ場判定 (寄り/引け 5 分除外 + 昼休み)
'---------------------------------------------------------------------------
Public Function IsMarketOpen(ByVal t As Date) As Boolean
    Dim tt As Date
    tt = TimeValue(t)
    Dim openT As Date, closeT As Date, lunchS As Date, lunchE As Date
    openT = modConfig.GetString("cfgMarketOpenTime", "09:00:00")
    closeT = modConfig.GetString("cfgMarketCloseTime", "15:00:00")
    lunchS = modConfig.GetString("cfgLunchStartTime", "11:30:00")
    lunchE = modConfig.GetString("cfgLunchEndTime", "12:30:00")

    ' 土日
    Select Case Weekday(t, vbMonday)
        Case 6, 7: IsMarketOpen = False: Exit Function
    End Select

    ' 寄り・引けの最初/最後 5 分を除外
    Dim skirtMin As Long
    skirtMin = 5
    If tt < openT + TimeSerial(0, skirtMin, 0) Then IsMarketOpen = False: Exit Function
    If tt > closeT - TimeSerial(0, skirtMin, 0) Then IsMarketOpen = False: Exit Function
    If tt >= lunchS And tt <= lunchE Then IsMarketOpen = False: Exit Function
    If tt < openT Or tt > closeT Then IsMarketOpen = False: Exit Function
    IsMarketOpen = True
End Function

'---------------------------------------------------------------------------
' SafeLongRead : 名前付きセルを Long として安全に読む
'---------------------------------------------------------------------------
Public Function SafeLongRead(ByVal nameKey As String, ByVal def As Long) As Long
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names(nameKey).RefersToRange.Value
    If IsNumeric(v) Then SafeLongRead = CLng(v) Else SafeLongRead = def
    Exit Function
Fail:
    SafeLongRead = def
End Function
