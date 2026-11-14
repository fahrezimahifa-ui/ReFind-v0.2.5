# Run in an existing PowerShell session when the scheduled QA task is unavailable.
[CmdletBinding()]
param([switch]$Stop, [string]$Php = 'C:\xampp\php\php.exe')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$guard = Join-Path $PSScriptRoot 'qa-guard.php'
$worker = Join-Path $PSScriptRoot 'index-visual-photos.php'

function Start-QuietProcess([string]$File, [string]$Arguments, [switch]$Capture) {
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $File
    $start.Arguments = $Arguments
    $start.WorkingDirectory = $root
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $Capture.IsPresent
    $start.RedirectStandardError = $Capture.IsPresent
    return [System.Diagnostics.Process]::Start($start)
}

function Test-ScheduledQaIndexer {
    if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) { return $false }
    $task = Get-ScheduledTask -TaskName 'ReFind Visual Search QA' -TaskPath '\' -ErrorAction SilentlyContinue
    $launcher = Join-Path $root 'storage\setup\visual-index-task-quiet.exe'
    return ($task -and $task.State -ne 'Disabled' -and @($task.Actions | Where-Object {
        $_.Execute -eq $launcher -or $_.Arguments -eq ('"' + $worker + '" --drain')
    }).Count -gt 0)
}

$guardProcess = Start-QuietProcess $Php ('"{0}" "{1}"' -f $guard, $root) -Capture
try {
    if (-not $guardProcess.WaitForExit(10000) -or $guardProcess.ExitCode -ne 0) {
        throw 'Visual index launcher requires the owned QA installation.'
    }
} finally {
    if (-not $guardProcess.HasExited) { $guardProcess.Kill(); $guardProcess.WaitForExit() }
    $guardProcess.Dispose()
}

$runtime = Join-Path $root 'storage\setup'
$lockPath = Join-Path $runtime 'visual-index-loop.lock'
$stopPath = Join-Path $runtime 'visual-index-loop.stop'
$statusPath = Join-Path $runtime 'visual-index-loop-status.json'
if ($Stop) {
    [IO.File]::WriteAllText($stopPath, 'stop')
    $deadline = [DateTime]::UtcNow.AddSeconds(65)
    do {
        try {
            $lease = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
            $lease.Dispose()
            return
        } catch [IO.IOException] { Start-Sleep -Milliseconds 250 }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'The QA fallback did not finish its current tick within 65 seconds.'
}
if (Test-ScheduledQaIndexer) { throw 'Disable the ReFind Visual Search QA task before using the fallback.' }
try { $lock = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
catch [IO.IOException] { return }
try {
    if (Test-Path -LiteralPath $stopPath) { Remove-Item -LiteralPath $stopPath }
    while (-not (Test-Path -LiteralPath $stopPath) -and -not (Test-ScheduledQaIndexer)) {
        $tick = [DateTime]::UtcNow
        $capture = Join-Path $runtime 'visual-index-loop-result.json'
        $errors = Join-Path $runtime 'visual-index-loop-error.txt'
        $child = Start-QuietProcess $Php ('"{0}" --drain' -f $worker) -Capture
        try {
            $output = $child.StandardOutput.ReadToEndAsync()
            $errorOutput = $child.StandardError.ReadToEndAsync()
            $state = if ($child.WaitForExit(55000)) { if ($child.ExitCode -eq 0) { 'completed' } else { 'worker_error' } }
                     else { $child.Kill(); $child.WaitForExit(); 'worker_timeout' }
            [IO.File]::WriteAllText($capture, $output.GetAwaiter().GetResult())
            [IO.File]::WriteAllText($errors, $errorOutput.GetAwaiter().GetResult())
            $result = if ($state -eq 'completed') { Get-Content -Raw -LiteralPath $capture | ConvertFrom-Json } else { $null }
            @{tick_utc = $tick.ToString('o'); state = $state; result = $result} | ConvertTo-Json -Compress | Set-Content -LiteralPath $statusPath -Encoding ascii
            if ($result -and $result.paused -eq 'disabled') { break }
        } finally {
            if (-not $child.HasExited) { $child.Kill(); $child.WaitForExit() }
            $child.Dispose()
        }
        while ([DateTime]::UtcNow -lt $tick.AddSeconds(60) -and -not (Test-Path -LiteralPath $stopPath)) { Start-Sleep -Seconds 1 }
    }
} finally { $lock.Dispose() }
