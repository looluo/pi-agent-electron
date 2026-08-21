Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -match 'node|electron') -and ($_.CommandLine -match 'electron-ipc-migration')
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Output ("killed " + $_.ProcessId + " " + $_.Name)
}
Start-Sleep -Seconds 2
Write-Output ("port5173=" + (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Measure-Object).Count)
