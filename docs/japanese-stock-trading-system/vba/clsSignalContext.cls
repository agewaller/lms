VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "clsSignalContext"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'===========================================================================
' clsSignalContext - 戦略に渡される銘柄コンテキスト
'===========================================================================
Option Explicit

Public Code As String
Public Name As String
Public Last As Double
Public Volume As Long
Public OpenPrice As Double
Public HighPrice As Double
Public LowPrice As Double
Public Bid1 As Double
Public Ask1 As Double
Public Vwap As Double

'---------------------------------------------------------------------------
' SpreadBps : スプレッド (bps)
'---------------------------------------------------------------------------
Public Function SpreadBps() As Double
    If Bid1 <= 0 Or Ask1 <= 0 Then SpreadBps = 9999: Exit Function
    Dim mid As Double
    mid = (Bid1 + Ask1) / 2
    If mid <= 0 Then SpreadBps = 9999: Exit Function
    SpreadBps = (Ask1 - Bid1) / mid * 10000
End Function
