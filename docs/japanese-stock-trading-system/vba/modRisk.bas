Attribute VB_Name = "modRisk"
'===========================================================================
' modRisk - 発注前 / 常時リスクチェック、停止判定
'
' 原則:
'  - 副作用なしの純関数を基本とする (CheckXxx は結果文字列を返すだけ)
'  - Halt だけがフラグを書き換える
'  - 読取失敗は安全側扱い (停止とみなす)
'===========================================================================
Option Explicit

'---------------------------------------------------------------------------
' CheckRssHeartbeat : RSS の最終更新が古くないか
'---------------------------------------------------------------------------
Public Function CheckRssHeartbeat() As Boolean
    On Error GoTo Fail
    Dim ageSec As Long
    ageSec = modRssData.GetHeartbeatAge()
    Dim maxAge As Long
    maxAge = modConfig.GetLong("cfgRssHeartbeatMaxAgeSec", 10)
    CheckRssHeartbeat = (ageSec >= 0 And ageSec <= maxAge)
    Exit Function
Fail:
    CheckRssHeartbeat = False
End Function

'---------------------------------------------------------------------------
' RuntimeCheck : MainLoop 周期で呼ばれる常時チェック
'---------------------------------------------------------------------------
Public Function RuntimeCheck() As Boolean
    ' 日次損失上限
    Dim realized As Long
    realized = modPosition.GetRealizedPnlToday()
    Dim unreal As Long
    unreal = modPosition.GetUnrealizedPnl()
    Dim totalLossLong As Long
    totalLossLong = -(realized + unreal)  ' 損失は正の値に
    If totalLossLong >= modConfig.GetLong("cfgMaxLossPerDay", 20000) Then
        Halt "DAILY_LOSS_LIMIT " & totalLossLong
        RuntimeCheck = False
        Exit Function
    End If
    RuntimeCheck = True
End Function

'---------------------------------------------------------------------------
' PreCheckSignal : シグナル生成直後のプレチェック
'---------------------------------------------------------------------------
Public Function PreCheckSignal(ByVal sigId As String, _
                                ByRef ctx As clsSignalContext, _
                                ByRef result As clsSignalResult) As String
    Dim lossEstimate As Long
    lossEstimate = Abs(result.RefPrice - result.StopPrice) * result.Qty

    If lossEstimate > modConfig.GetLong("cfgMaxLossPerTrade", 5000) Then
        PreCheckSignal = "NG: LOSS_PER_TRADE_OVER=" & lossEstimate
        Exit Function
    End If

    Dim positionYen As Long
    positionYen = result.RefPrice * result.Qty
    If positionYen > modConfig.GetLong("cfgMaxPositionPerSymbol", 300000) Then
        PreCheckSignal = "NG: POSITION_PER_SYMBOL_OVER=" & positionYen
        Exit Function
    End If

    PreCheckSignal = "OK"
End Function

'---------------------------------------------------------------------------
' PreCheckOrder : 発注前チェック（発注直前に呼ばれる）
'  OK / NG:<理由> を返す。副作用なし。
'---------------------------------------------------------------------------
Public Function PreCheckOrder(ByRef o As clsOrder) As String
    ' 1) 停止中
    If modConfig.IsKillSwitchOn() Then PreCheckOrder = "NG: KILLSWITCH": Exit Function
    If Not modConfig.IsTradingEnabled() Then PreCheckOrder = "NG: TRADING_DISABLED": Exit Function

    ' 2) ザラ場時間
    If Not modUtils.IsMarketOpen(Now) Then PreCheckOrder = "NG: MARKET_CLOSED": Exit Function

    ' 3) RSS 生きてる
    If Not CheckRssHeartbeat() Then PreCheckOrder = "NG: RSS_STALE": Exit Function

    ' 4) 成行許可
    If modConfig.AllowedOrderType() = "LIMIT" And UCase$(o.OrderType) = "MARKET" Then
        PreCheckOrder = "NG: ORDER_TYPE_NOT_ALLOWED": Exit Function
    End If

    ' 5) 買付余力
    Dim cash As Long
    cash = modRssData.GetCashBalance()
    Dim need As Long
    need = o.Price * o.Qty
    If need * 1.05 > cash Then PreCheckOrder = "NG: INSUFFICIENT_FUNDS": Exit Function

    ' 6) 同時保有数上限
    If o.Side = "BUY" Then
        If modPosition.GetPositions().Count >= modConfig.GetLong("cfgMaxConcurrentPositions", 3) Then
            PreCheckOrder = "NG: CONCURRENT_MAX": Exit Function
        End If
    End If

    ' 7) 1 銘柄あたり投資額
    Dim symbolYen As Long
    symbolYen = modPosition.GetSymbolExposureYen(o.Code) + need
    If symbolYen > modConfig.GetLong("cfgMaxPositionPerSymbol", 300000) Then
        PreCheckOrder = "NG: SYMBOL_EXPOSURE_OVER": Exit Function
    End If

    ' 8) 1 日発注回数
    If modConfig.GetLong("stateTodayOrders", 0) >= modConfig.GetLong("cfgMaxOrdersPerDay", 10) Then
        PreCheckOrder = "NG: DAILY_ORDER_COUNT": Exit Function
    End If

    ' 9) 同一銘柄の未約定
    If Not modOrder.FindOpenOrderBySymbol(o.Code) Is Nothing Then
        PreCheckOrder = "NG: SYMBOL_HAS_OPEN_ORDER": Exit Function
    End If

    ' 10) 二重クリック防止
    If Not modOrder.CheckOrderInterval() Then
        PreCheckOrder = "NG: TOO_FAST": Exit Function
    End If

    ' 11) 数量妥当性
    If o.Qty <= 0 Then PreCheckOrder = "NG: QTY_ZERO": Exit Function

    ' 12) 価格妥当性（指値と最終値の乖離）
    Dim last As Double
    last = modRssData.GetLastPrice(o.Code)
    If last > 0 Then
        Dim bps As Double
        bps = Abs(o.Price - last) / last * 10000
        If bps > modConfig.GetLong("cfgMaxPriceSlippageBps", 30) Then
            PreCheckOrder = "NG: PRICE_FAR_FROM_LAST=" & Round(bps, 1) & "bps"
            Exit Function
        End If
    End If

    PreCheckOrder = "OK"
End Function

'---------------------------------------------------------------------------
' Halt : 停止フラグを立てる（副作用あり）
'---------------------------------------------------------------------------
Public Sub Halt(ByVal reason As String)
    On Error Resume Next
    Dim prev As String
    prev = modConfig.GetString("stateHaltReason", "")
    If prev = reason Then Exit Sub  ' 同じ理由の連発はスキップ

    ThisWorkbook.Names("cfgKillSwitch").RefersToRange.Value = True
    ThisWorkbook.Names("cfgTradingEnabled").RefersToRange.Value = False
    ThisWorkbook.Names("stateHaltReason").RefersToRange.Value = reason
    modLog.ErrorLog "modRisk", "Halt", 0, reason, "", "FATAL"
    modNotify.NotifyFatal "HALTED: " & reason
End Sub

'---------------------------------------------------------------------------
' Resume : 手動再開
'---------------------------------------------------------------------------
Public Sub ResumeBy(ByVal userName As String)
    On Error Resume Next
    ThisWorkbook.Names("cfgKillSwitch").RefersToRange.Value = False
    ThisWorkbook.Names("stateHaltReason").RefersToRange.Value = ""
    ' TradingEnabled は手動で TRUE にしてもらう
    modLog.Info "SYSTEM", "Resume", "Resumed by " & userName
    modNotify.NotifyInfo "[trading] RESUMED by " & userName
End Sub
