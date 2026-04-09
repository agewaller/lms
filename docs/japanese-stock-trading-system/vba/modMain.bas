Attribute VB_Name = "modMain"
'===========================================================================
' modMain - entry point / 監視ループ / 初期化 / 緊急停止
'
' Phase 1 (通知型) の中核。発注経路には直接触れない。
'===========================================================================
Option Explicit

Private Const ONTIME_ID_CELL As String = "_meta!B2"
Private mNextTickScheduled As Date
Private mRunning As Boolean

'---------------------------------------------------------------------------
' Startup : ブックが開かれた時の初期化
'---------------------------------------------------------------------------
Public Sub Startup()
    On Error GoTo Fail

    ' 1) 設定読込（安全側デフォルト）
    modConfig.Refresh

    ' 2) 再起動直後は必ず取引OFF + 停止理由明記
    ThisWorkbook.Names("cfgTradingEnabled").RefersToRange.Value = False
    ThisWorkbook.Names("stateHaltReason").RefersToRange.Value = "再起動直後（人確認待ち）"

    ' 3) 起動ログ
    modLog.Info "SYSTEM", "Startup", "trading.xlsm opened"

    ' 4) ハートビート初期化
    modRssData.ResetHeartbeat

    ' 5) 監視ループ開始
    mRunning = True
    ScheduleNextTick

    ' 6) 通知
    modNotify.NotifyInfo "[trading] STARTUP complete (TradingEnabled=FALSE)"

    Exit Sub
Fail:
    modLog.ErrorLog "modMain", "Startup", Err.Number, Err.Description, "", "FATAL"
    modNotify.NotifyFatal "Startup failed: " & Err.Description
End Sub

'---------------------------------------------------------------------------
' Shutdown : 終了処理
'---------------------------------------------------------------------------
Public Sub Shutdown()
    On Error Resume Next
    mRunning = False
    CancelNextTick
    modLog.Info "SYSTEM", "Shutdown", "trading.xlsm closing"
    modNotify.NotifyInfo "[trading] SHUTDOWN"
End Sub

'---------------------------------------------------------------------------
' MainLoop : OnTime から呼ばれる監視ループ本体
'---------------------------------------------------------------------------
Public Sub MainLoop()
    If Not mRunning Then Exit Sub

    On Error GoTo Fail

    ' (1) KillSwitch / TradingEnabled
    If modConfig.IsKillSwitchOn() Then
        modLog.Warn "SYSTEM", "MainLoop", "KillSwitch ON detected"
        modNotify.NotifyFatal "KILLSWITCH ACTIVE: " & modConfig.GetString("stateHaltReason", "")
        ScheduleNextTick
        Exit Sub
    End If

    ' (2) RSS ハートビート監視（常に確認）
    If Not modRisk.CheckRssHeartbeat() Then
        modRisk.Halt "RSS_STALE"
        ScheduleNextTick
        Exit Sub
    End If

    ' (3) 余力/建玉同期（失敗したら停止）
    If Not modPosition.SyncFromRss() Then
        modRisk.Halt "POSITION_SYNC_FAIL"
        ScheduleNextTick
        Exit Sub
    End If

    ' (4) 常時リスクチェック（日次損失など）
    If Not modRisk.RuntimeCheck() Then
        ScheduleNextTick
        Exit Sub
    End If

    ' (5) シグナル走査
    modSignal.ScanAll

    ' (6) 監視ダッシュボード更新
    UpdateDashboard

    ' (7) 次の周回予約
    ScheduleNextTick
    Exit Sub

Fail:
    modLog.ErrorLog "modMain", "MainLoop", Err.Number, Err.Description, "", "ERROR"
    ' ループ自体は継続する（軽度エラーで全停止しない）
    ScheduleNextTick
End Sub

'---------------------------------------------------------------------------
' ScheduleNextTick : 次の起動を予約（OnTime 多重起動防止）
'---------------------------------------------------------------------------
Public Sub ScheduleNextTick()
    On Error Resume Next
    CancelNextTick
    Dim ms As Long
    ms = modConfig.GetLong("cfgLoopIntervalMs", 3000)
    mNextTickScheduled = Now + TimeSerial(0, 0, ms \ 1000)
    Application.OnTime mNextTickScheduled, "modMain.MainLoop"
End Sub

Public Sub CancelNextTick()
    On Error Resume Next
    If mNextTickScheduled > 0 Then
        Application.OnTime mNextTickScheduled, "modMain.MainLoop", , False
    End If
    mNextTickScheduled = 0
End Sub

'---------------------------------------------------------------------------
' EmergencyStop : ボタン or コードから呼ばれる緊急停止
'---------------------------------------------------------------------------
Public Sub EmergencyStop(ByVal reason As String)
    On Error Resume Next
    ThisWorkbook.Names("cfgKillSwitch").RefersToRange.Value = True
    ThisWorkbook.Names("cfgTradingEnabled").RefersToRange.Value = False
    ThisWorkbook.Names("stateHaltReason").RefersToRange.Value = reason
    modLog.ErrorLog "SYSTEM", "EmergencyStop", 0, reason, "", "FATAL"
    modNotify.NotifyFatal "EMERGENCY STOP: " & reason
End Sub

'---------------------------------------------------------------------------
' UpdateDashboard : 監視ダッシュボード更新
'---------------------------------------------------------------------------
Private Sub UpdateDashboard()
    On Error Resume Next
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("監視ダッシュボード")
    ws.Range("B2").Value = IIf(mRunning, "RUNNING", "STOPPED")
    ws.Range("B3").Value = Now
    ws.Range("B4").Value = modConfig.IsTradingEnabled()
    ws.Range("B5").Value = modConfig.IsKillSwitchOn()
    ws.Range("B6").Value = modPosition.GetRealizedPnlToday()
    ws.Range("B7").Value = modPosition.GetUnrealizedPnl()
    ws.Range("B8").Value = modConfig.GetLong("stateTodayOrders", 0)
    ws.Range("B9").Value = modLog.ErrorCountToday()
    ws.Range("B10").Value = modPosition.GetPositions().Count & " / " & _
                            modConfig.GetLong("cfgMaxConcurrentPositions", 3)
End Sub
