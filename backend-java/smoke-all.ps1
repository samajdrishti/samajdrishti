$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$suites = @(
  'smoke-1-auth-projects.ps1',
  'smoke-2-inspections.ps1',
  'smoke-3-modules.ps1',
  'smoke-4-ai-integration.ps1'
)

$totalPass = 0
$totalFail = 0
$allFails = @()

foreach ($suite in $suites) {
  Write-Host ''
  Write-Host ("=" * 70)
  Write-Host "  $suite"
  Write-Host ("=" * 70)
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here $suite) 2>&1 | Out-String
  $out -split "`r?`n" | Where-Object { $_ -match '^(PASS|FAIL)' } | ForEach-Object { Write-Host $_ }
  if ($out -match 'SUBTOTAL\s+pass=(\d+)\s+fail=(\d+)') {
    $totalPass += [int]$Matches[1]
    $totalFail += [int]$Matches[2]
  }
  $allFails += ($out -split "`r?`n") | Where-Object { $_ -match '^\s+- ' }
}

Write-Host ''
Write-Host ("TOTAL  pass={0}  fail={1}" -f $totalPass, $totalFail)
if ($allFails) {
  Write-Host 'Failures:'
  $allFails | ForEach-Object { Write-Host $_ }
  exit 1
}
exit 0
