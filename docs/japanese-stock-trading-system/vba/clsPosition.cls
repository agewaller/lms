VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "clsPosition"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'===========================================================================
' clsPosition - 建玉オブジェクト
'===========================================================================
Option Explicit

Public Code As String
Public Name As String
Public Qty As Long
Public AvgPrice As Double
Public LastPrice As Double
Public StopPrice As Double
Public TakePrice As Double
Public OpenedAt As Date
Public SourceSignalId As String
