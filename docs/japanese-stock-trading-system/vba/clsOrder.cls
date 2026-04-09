VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "clsOrder"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'===========================================================================
' clsOrder - 注文オブジェクト (NEW/SENT/PART/FILLED/CANCEL/REJECT/ERROR)
'===========================================================================
Option Explicit

Public OrderIdInternal As String
Public OrderIdExternal As String
Public SignalId As String
Public Code As String
Public Side As String
Public Qty As Long
Public Price As Double
Public OrderType As String       ' LIMIT / MARKET / STOP
Public State As String
Public ErrorCode As String
Public FillQty As Long
Public FillPrice As Double
Public CreatedAt As Date
Public FinishedAt As Date
