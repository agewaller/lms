VERSION 1.0 CLASS
BEGIN
  MultiUse = -1
END
Attribute VB_Name = "clsStrategyBreakout"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = False
Attribute VB_Exposed = False
'===========================================================================
' clsStrategyBreakout - "当日高値ブレイク" の最小戦略
'
'   条件:
'     - 現在値 > 当日高値 - 1 tick
'     - 現在値 > VWAP
'     - 出来高 > 基準
'   数量: 1銘柄投資額上限から逆算
'   損切: 直近安値 or -0.5%
'   利確: +1.0%
'===========================================================================
Option Explicit

Public Property Get Name() As String
    Name = "breakout_v1"
End Property

Public Function Evaluate(ByRef ctx As clsSignalContext) As clsSignalResult
    Dim r As clsSignalResult
    Set r = New clsSignalResult
    r.Hit = False
    r.Side = "BUY"

    ' 簡易条件
    If ctx.Last >= ctx.HighPrice And ctx.Last > ctx.Vwap Then
        Dim maxYen As Long
        maxYen = modConfig.GetLong("cfgMaxPositionPerSymbol", 300000)
        Dim qty As Long
        If ctx.Last > 0 Then
            qty = (maxYen \ CLng(ctx.Last)) \ 100 * 100  ' 単元 100 株想定
        End If
        If qty <= 0 Then Set Evaluate = r: Exit Function

        r.Hit = True
        r.Qty = qty
        r.RefPrice = ctx.Last
        r.StopPrice = Round(ctx.Last * 0.995, 1)
        r.TakePrice = Round(ctx.Last * 1.01, 1)
        r.Reason = "当日高値ブレイク + VWAP 上"
    End If

    Set Evaluate = r
End Function
