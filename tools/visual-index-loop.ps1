# Start once in the signed-in QA session. The child process keeps the PHP drain off request threads.
[CmdletBinding()]
param([switch]$Run, [switch]$Stop, [string]$Php = 'C:\xampp\php\php.exe')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$guard = Join-Path $PSScriptRoot 'qa-guard.php'
& $Php $guard $root | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Visual index launcher requires the owned QA installation.' }
$runtime = Join-Path $root 'storage\setup'
$lockPath = Join-Path $runtime 'visual-index-loop.lock'
$stopPath = Join-Path $runtime 'visual-index-loop.stop'
$statusPath = Join-Path $runtime 'visual-index-loop-status.json'
if ($Stop) { [IO.File]::WriteAllText($stopPath, 'stop'); return }
if (-not $Run) {
    $powerShell = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $powerShell)) { $powerShell = Join-Path $PSHOME 'pwsh.exe' }
    Start-Process -FilePath $powerShell -ArgumentList @('-NoProfile','-NonInteractive','-File',('"'+$PSCommandPath+'"'),'-Run','-Php',('"'+$Php+'"')) -WindowStyle Hidden
    return
}
try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
catch [IO.IOException] { return }
try {
    if (Test-Path -LiteralPath $stopPath) { Remove-Item -LiteralPath $stopPath }
    while (-not (Test-Path -LiteralPath $stopPath)) {
        $tick = [DateTime]::UtcNow
        $worker = Join-Path $PSScriptRoot 'index-visual-photos.php'
        $capture = Join-Path $runtime 'visual-index-loop-result.json'
        $errors = Join-Path $runtime 'visual-index-loop-error.txt'
        $child = Start-Process -FilePath $Php -ArgumentList @(('"' + $worker + '"'),'--drain') -WindowStyle Hidden -PassThru -RedirectStandardOutput $capture -RedirectStandardError $errors
        try {
            $state = if ($child.WaitForExit(55000)) { if ($child.ExitCode -eq 0) { 'completed' } else { 'worker_error' } }
                     else { Stop-Process -InputObject $child; 'worker_timeout' }
            $result = if ($state -eq 'completed') { Get-Content -Raw -LiteralPath $capture | ConvertFrom-Json } else { $null }
            @{tick_utc = $tick.ToString('o'); state = $state; result = $result} | ConvertTo-Json -Compress | Set-Content -LiteralPath $statusPath -Encoding ascii
        } finally { $child.Dispose() }
        while ([DateTime]::UtcNow -lt $tick.AddSeconds(60) -and -not (Test-Path -LiteralPath $stopPath)) { Start-Sleep -Seconds 1 }
    }
} finally { $lock.Dispose() }
