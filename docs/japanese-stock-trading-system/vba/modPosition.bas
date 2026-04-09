Attribute VB_Name = "modPosition"
'===========================================================================
' modPosition - 建玉同期 / 損益計算
'===========================================================================
Option Explicit

Private mPositions As Collection    ' key=code

'---------------------------------------------------------------------------
' SyncFromRss : RSS 側の建玉一覧を読み、建玉管理シートと突き合わせる
'   成功時 True、失敗/不整合時 False
'---------------------------------------------------------------------------
Public Function SyncFromRss() As Boolean
    On Error GoTo Fail
    Dim rssCol As Collection
    Set rssCol = modRssData.GetPositions()
    If rssCol Is Nothing Then SyncFromRss = False: Exit Function

    Set mPositions = rssCol

    ' 建玉管理シートを再生成
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("建玉管理")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow >= 2 Then
        ws.Rows("2:" & lastRow).ClearContents
    End If

    Dim r As Long
    r = 2
    Dim i As Long
    For i = 1 To rssCol.Count
        Dim p As clsPosition
        Set p = rssCol.Item(i)
        ws.Cells(r, "A").Value = "POS-" & p.Code & "-001"
        ws.Cells(r, "B").Value = p.Code
        ws.Cells(r, "C").Value = p.Name
        ws.Cells(r, "D").Value = "現物"
        ws.Cells(r, "E").Value = p.Qty
        ws.Cells(r, "F").Value = p.AvgPrice
        ws.Cells(r, "G").Value = p.LastPrice
        ws.Cells(r, "H").Value = p.LastPrice * p.Qty
        ws.Cells(r, "I").Value = (p.LastPrice - p.AvgPrice) * p.Qty
        If p.AvgPrice > 0 Then
            ws.Cells(r, "J").Value = (p.LastPrice - p.AvgPrice) / p.AvgPrice
        End If
        ws.Cells(r, "O").Value = Now
        r = r + 1
    Next i

    SyncFromRss = True
    Exit Function
Fail:
    modLog.ErrorLog "modPosition", "SyncFromRss", Err.Number, Err.Description, "", "FATAL"
    SyncFromRss = False
End Function

Public Function GetPositions() As Collection
    If mPositions Is Nothing Then Set mPositions = New Collection
    Set GetPositions = mPositions
End Function

Public Function GetSymbolExposureYen(ByVal code As String) As Long
    On Error Resume Next
    If mPositions Is Nothing Then GetSymbolExposureYen = 0: Exit Function
    Dim p As clsPosition
    Set p = mPositions(code)
    If p Is Nothing Then
        GetSymbolExposureYen = 0
    Else
        GetSymbolExposureYen = CLng(p.LastPrice * p.Qty)
    End If
End Function

Public Function GetUnrealizedPnl() As Long
    On Error Resume Next
    If mPositions Is Nothing Then GetUnrealizedPnl = 0: Exit Function
    Dim total As Long, i As Long
    For i = 1 To mPositions.Count
        Dim p As clsPosition
        Set p = mPositions.Item(i)
        total = total + CLng((p.LastPrice - p.AvgPrice) * p.Qty)
    Next i
    GetUnrealizedPnl = total
End Function

Public Function GetRealizedPnlToday() As Long
    ' 約定履歴 シートを走査して当日実現損益を計算
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("約定履歴")
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow < 2 Then GetRealizedPnlToday = 0: Exit Function

    ' 単純モデル: BUY -> SELL のペアリングは行わず、
    ' PAPER では約定履歴の "損益" 列を合計する想定
    Dim total As Long, r As Long
    For r = 2 To lastRow
        If DateValue(ws.Cells(r, 4).Value) = Date Then
            total = total + CLng(Nz(ws.Cells(r, 11).Value, 0))
        End If
    Next r
    GetRealizedPnlToday = total
End Function

Private Function Nz(v As Variant, ByVal def As Variant) As Variant
    If IsNull(v) Or IsEmpty(v) Or v = "" Then Nz = def Else Nz = v
End Function
