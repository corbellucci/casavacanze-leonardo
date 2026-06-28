<#
  server-bg.ps1 — avvio/stop del server in BACKGROUND su Windows.

  Pensato per essere lanciato anche da WSL/agente senza bloccare la sessione.

  NB: NON si usa -RedirectStandardOutput/-RedirectStandardError di Start-Process,
  perche' quegli stream asincroni tengono vivo il processo padre e, invocando
  powershell.exe da WSL, la chiamata va in TIMEOUT (il bug "worker"/blocco).
  La redirezione e' delegata alla shell tramite un wrapper cmd (> log 2> err),
  cosi' cmd/PowerShell escono subito e node resta detached in background.

  Uso (da WSL):
    powershell.exe -ExecutionPolicy Bypass -File scripts/server-bg.ps1 start
    powershell.exe -ExecutionPolicy Bypass -File scripts/server-bg.ps1 stop
    powershell.exe -ExecutionPolicy Bypass -File scripts/server-bg.ps1 status

  Log:  _srv.log   |   PID file: _srv.pid
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $root '_srv.log'
$pidFile = Join-Path $root '_srv.pid'
$entry   = Join-Path $root 'src\server.js'

function Get-ServerPid {
  if (Test-Path $pidFile) {
    $p = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) { return [int]$p }
  }
  return $null
}

switch ($Action) {
  'start' {
    $existing = Get-ServerPid
    if ($existing) { Write-Host "Server gia' attivo (PID $existing)"; break }

    # Avvio detached via wrapper cmd: la redirezione e' a livello di shell, NON
    # di Start-Process, cosi' il padre ritorna subito (niente timeout su WSL).
    $cmdArgs = "/c node `"$entry`" > `"$logFile`" 2> `"$logFile.err`""
    $proc = Start-Process -FilePath $env:ComSpec -ArgumentList $cmdArgs `
      -WorkingDirectory $root -WindowStyle Hidden -PassThru

    # Recupera il PID reale di node (figlio del cmd appena avviato).
    Start-Sleep -Milliseconds 400
    $node = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ParentProcessId -eq $proc.Id } | Select-Object -First 1
    $serverPid = if ($node) { [int]$node.ProcessId } else { [int]$proc.Id }
    $serverPid | Out-File -FilePath $pidFile -Encoding ascii
    Write-Host "Server avviato in background (PID $serverPid) -> $logFile"
  }
  'stop' {
    $p = Get-ServerPid
    if ($p) {
      # /T termina anche eventuali processi figli (es. il wrapper cmd).
      & taskkill /PID $p /T /F *> $null
      Remove-Item $pidFile -ErrorAction SilentlyContinue
      Write-Host "Server fermato (PID $p)"
    } else {
      Write-Host 'Nessun server attivo (da PID file).'
    }
  }
  'restart' {
    & $PSCommandPath stop
    Start-Sleep -Seconds 1
    & $PSCommandPath start
  }
  'status' {
    $p = Get-ServerPid
    if ($p) { Write-Host "ATTIVO (PID $p)" } else { Write-Host 'NON attivo' }
  }
}
