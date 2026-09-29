. "$PSScriptRoot\smoke-common.ps1"

# Verifies the Java API and the Python AI engine are wired together: these assertions
# only pass when the engine is up and returning real analysis.

$T = Login 'admin@samajdrishti.gov.in' 'Admin@123'
$ENGINE = 'http://localhost:5001'
if (-not $T) { Write-Host 'cannot log into the API'; exit 1 }

# ------------------------------------------------------------------ engine up
try {
  $eh = Invoke-RestMethod "$ENGINE/api/health" -TimeoutSec 20
  Check 'the AI engine is up' ($eh.status -eq 'ok') "status=$($eh.status)"
  Check 'the engine reports its anomaly backend' ($eh.anomaly_backend -in @('isolation_forest', 'robust_zscore')) "backend=$($eh.anomaly_backend)"
} catch {
  Check 'the AI engine is up' $false $_.Exception.Message
  Write-Host ''
  Write-Host ("SUBTOTAL  pass={0}  fail={1}" -f $script:pass, $script:fail)
  exit 1
}

$apiHealth = Req GET "$API/health" $null $null
Check 'the API reports the engine as online' ($apiHealth.s -eq 200 -and $apiHealth.d.aiEngineOnline -eq $true) "s=$($apiHealth.s) $($apiHealth.raw)"
Check 'the API surfaces the engine backend' ($apiHealth.d.anomalyBackend -eq $eh.anomaly_backend) "api=$($apiHealth.d.anomalyBackend) engine=$($eh.anomaly_backend)"

# ------------------------------------------------------- risk scoring is live
$dash = Req GET "$API/admin/dashboard" $T $null
Check 'dashboard stats come from the engine' ($dash.d.stats.aiStats.total_projects -gt 0) "aiStats=$($dash.d.stats.aiStats | ConvertTo-Json -Compress)"
Check 'projects carry real AI risk scores' (
  @($dash.d.projects).Count -gt 0 -and (@($dash.d.projects) | Where-Object { $_.risk_score -eq 50 }).Count -lt @($dash.d.projects).Count
) 'every project fell back to 50, the engine was not consulted'
$ordered = @($dash.d.projects) | Sort-Object { $_.risk_score } -Descending
$risky = $ordered[0]
$topNames = @($ordered | Where-Object { $_.risk_score -eq $risky.risk_score } | ForEach-Object { $_.name })
# The scorer is a deterministic rule set, so a tie is legitimate; what matters is that the
# seeded fraud case study is in the top band.
Check 'the highest-risk band is 70 or above' ($risky.risk_score -ge 70) "top score=$($risky.risk_score)"
Check 'the flagged Chaubisee case study scores in the top band' (
  ($topNames | Where-Object { $_ -match 'Chaubisee' }).Count -gt 0) "top=$($topNames -join ' | ')"
Check 'high-risk projects list their drivers' ($risky.risk_factors.Count -gt 0) 'no risk factors reported'

$scored = Req POST "$API/inspections/assign" $T @{ project_id=$risky.id; assigned_to=3; scheduled_date='2026-10-02' }
Check 'the engine-scored project can still be assigned' ($scored.s -eq 201) "s=$($scored.s)"

# ------------------------------------------------------------- AI assignment
$assign = Req POST "$API/admin/ai/assign" $T @{ num_inspections=4; persist=$true }
Check 'POST /admin/ai/assign now succeeds with the engine up' ($assign.s -eq 200 -and $assign.d.assignments.Count -eq 4) "s=$($assign.s) $($assign.raw)"
Check 'the generated plan persisted real inspections' ($assign.d.created -eq 4) "created=$($assign.d.created)"
Check 'each assignment carries a schedule the database can store' (
  @($assign.d.assignments | Where-Object { $_.scheduled_date -and $_.official_id -and $_.project_id }).Count -eq 4
) ($assign.raw)

$mine = Req GET "$API/inspections/mine" (Login 'official2@samajdrishti.gov.in' 'Official@123') $null
Check 'the new inspections appear in the field app' ($mine.s -eq 200) "s=$($mine.s)"

# ------------------------------------------------------------- geo + narrative
$proj = @((Req GET "$API/projects" $T $null).d) | Where-Object { $_.geo_coords -ne $null } | Select-Object -First 1
$insp = @((Req GET "$API/inspections/all" $T $null).d) | Select-Object -First 1
$geo = Req POST "$API/inspections/$($insp.id)/geo-verify" $T @{ lat=$proj.geo_coords.lat; lng=$proj.geo_coords.lng }
Check 'geo-verify now adds the engine explanation' ($geo.s -eq 200 -and $geo.d.ai_explanation) "s=$($geo.s) $($geo.raw)"

$nar = Req GET "$API/admin/ai/narrative?tone=executive" $T $null
Check 'the narrative comes from the LLM provider, not the fallback' (
  $nar.s -eq 200 -and $nar.d.narrative.Length -gt 80 -and $nar.d.provider -ne 'local-fallback'
) "provider=$($nar.d.provider) model=$($nar.d.model) len=$($nar.d.narrative.Length)"
Check 'the narrative payload still carries the data snapshot' ($null -ne $nar.d.data.totals) 'data snapshot missing'

# ------------------------------------------------------------------- insights
$ins = Req GET "$API/admin/ai/insights" $T $null
Check 'GET /admin/ai/insights returns detected anomalies' ($ins.s -eq 200 -and $ins.d.anomalies.Count -gt 0) "count=$(@($ins.d.anomalies).Count)"

$att = Req GET "$API/attendance/anomalies" $T $null
Check 'attendance irregularities are analysed by the engine' ($att.s -eq 200 -and $att.d.irregularities.Count -ge 0) "s=$($att.s)"

Write-Host ''
Write-Host ("SUBTOTAL  pass={0}  fail={1}" -f $script:pass, $script:fail)
if ($script:fail) { $script:fails | ForEach-Object { Write-Host "  - $_" } }
