VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "clsSignalResult"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'===========================================================================
' clsSignalResult - 戦略が返す判定結果
'===========================================================================
Option Explicit

Public Hit As Boolean
Public Side As String         ' BUY / SELL
Public Qty As Long
Public RefPrice As Double
Public StopPrice As Double    ' 損切
Public TakePrice As Double    ' 利確
Public Reason As String
