Attribute VB_Name = "modConfig"
'===========================================================================
' modConfig - 設定アクセサ（名前付きセル → 安全に読む）
'
' 原則: 読み取り失敗時は "安全側" デフォルトを返す。
'===========================================================================
Option Explicit

'---------------------------------------------------------------------------
' Refresh : 必要ならキャッシュをクリア（現状は名前付きセル直読）
'---------------------------------------------------------------------------
Public Sub Refresh()
    ' 将来キャッシュ化する時のためのフック
End Sub

'---------------------------------------------------------------------------
' GetLong
'---------------------------------------------------------------------------
Public Function GetLong(ByVal nameKey As String, ByVal defaultValue As Long) As Long
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names(nameKey).RefersToRange.Value
    If IsNumeric(v) Then
        GetLong = CLng(v)
    Else
        GetLong = defaultValue
    End If
    Exit Function
Fail:
    GetLong = defaultValue
End Function

'---------------------------------------------------------------------------
' GetDouble
'---------------------------------------------------------------------------
Public Function GetDouble(ByVal nameKey As String, ByVal defaultValue As Double) As Double
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names(nameKey).RefersToRange.Value
    If IsNumeric(v) Then
        GetDouble = CDbl(v)
    Else
        GetDouble = defaultValue
    End If
    Exit Function
Fail:
    GetDouble = defaultValue
End Function

'---------------------------------------------------------------------------
' GetBool
'---------------------------------------------------------------------------
Public Function GetBool(ByVal nameKey As String, ByVal defaultValue As Boolean) As Boolean
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names(nameKey).RefersToRange.Value
    If IsNull(v) Or IsEmpty(v) Then
        GetBool = defaultValue
    Else
        GetBool = CBool(v)
    End If
    Exit Function
Fail:
    GetBool = defaultValue
End Function

'---------------------------------------------------------------------------
' GetString
'---------------------------------------------------------------------------
Public Function GetString(ByVal nameKey As String, ByVal defaultValue As String) As String
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names(nameKey).RefersToRange.Value
    If IsNull(v) Or IsEmpty(v) Then
        GetString = defaultValue
    Else
        GetString = CStr(v)
    End If
    Exit Function
Fail:
    GetString = defaultValue
End Function

'---------------------------------------------------------------------------
' IsKillSwitchOn : 読取失敗時は "TRUE（押されている扱い）" を返す
'                   → フェイルセーフ（安全側デフォルト）
'---------------------------------------------------------------------------
Public Function IsKillSwitchOn() As Boolean
    On Error GoTo Fail
    Dim v As Variant
    v = ThisWorkbook.Names("cfgKillSwitch").RefersToRange.Value
    IsKillSwitchOn = CBool(v)
    Exit Function
Fail:
    ' 読めなかったら安全側: 停止扱い
    IsKillSwitchOn = True
End Function

'---------------------------------------------------------------------------
' IsTradingEnabled : 読取失敗時は FALSE（安全側）
'---------------------------------------------------------------------------
Public Function IsTradingEnabled() As Boolean
    IsTradingEnabled = GetBool("cfgTradingEnabled", False)
End Function

'---------------------------------------------------------------------------
' AllowedOrderType : 読取失敗時は "LIMIT" を返す（成行禁止）
'---------------------------------------------------------------------------
Public Function AllowedOrderType() As String
    Dim s As String
    s = GetString("cfgAllowedOrderType", "LIMIT")
    Select Case UCase$(s)
        Case "LIMIT", "MARKET", "ANY"
            AllowedOrderType = UCase$(s)
        Case Else
            AllowedOrderType = "LIMIT"
    End Select
End Function

'---------------------------------------------------------------------------
' TradingMode : "PAPER" / "LIVE" / "OBSERVE" （安全側既定 PAPER）
'---------------------------------------------------------------------------
Public Function TradingMode() As String
    Dim s As String
    s = UCase$(GetString("cfgTradingMode", "PAPER"))
    Select Case s
        Case "PAPER", "LIVE", "OBSERVE"
            TradingMode = s
        Case Else
            TradingMode = "PAPER"
    End Select
End Function

'---------------------------------------------------------------------------
' ApprovalRequired : 読取失敗時は TRUE（安全側 = 承認必須）
'---------------------------------------------------------------------------
Public Function ApprovalRequired() As Boolean
    ApprovalRequired = GetBool("cfgApprovalRequired", True)
End Function
