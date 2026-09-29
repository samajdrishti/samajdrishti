. "$PSScriptRoot\smoke-common.ps1"

$T  = Login 'admin@samajdrishti.gov.in' 'Admin@123'
$TS = Login 'supervisor@samajdrishti.gov.in' 'Super@123'
$TO = Login 'official1@samajdrishti.gov.in' 'Official@123'
if (-not $T -or -not $TO) { Write-Host 'cannot log in, aborting'; exit 1 }

# -------------------------------------------------------------- inspections
$all = Req GET "$API/inspections/all" $T $null
Check 'GET /inspections/all -> array' ($all.s -eq 200 -and $all.d.Count -gt 0) "s=$($all.s)"
$inspections = @($all.d)
Check 'inspections/all joins project_name and official_name' (
  $inspections[0].PSObject.Properties.Name -contains 'project_name' -and
  $inspections[0].PSObject.Properties.Name -contains 'official_name') ($inspections[0].PSObject.Properties.Name -join ',')
Check 'GET /inspections/mine as official -> 200' ((Req GET "$API/inspections/mine" $TO $null).s -eq 200) 'expected 200'
Check 'GET /inspections/mine as admin -> 200' ((Req GET "$API/inspections/mine" $T $null).s -eq 200) 'expected 200'
Check 'GET /inspections/all as official -> 403' ((Req GET "$API/inspections/all" $TO $null).s -eq 403) 'expected 403'

$one = Req GET "$API/inspections/$($inspections[0].id)" $T $null
Check 'GET /inspections/:id -> joined row' ($one.s -eq 200 -and $null -ne $one.d.project_name) "s=$($one.s)"

$assign = Req POST "$API/inspections/assign" $T @{ project_id=$one.d.project_id; assigned_to=$inspections[0].assigned_to; scheduled_date='2026-10-01'; ai_risk_score=42 }
Check 'POST /inspections/assign -> 201 with the inspection' ($assign.s -eq 201 -and $assign.d.id) "s=$($assign.s) $($assign.raw)"
$newInspId = if ($assign.s -eq 201) { $assign.d.id } else { $null }
Check 'POST /inspections/assign as official -> 403' ((Req POST "$API/inspections/assign" $TO @{ project_id=$one.d.project_id; assigned_to=2; scheduled_date='2026-10-01' }).s -eq 403) 'expected 403'

# geo verification, against the inspection's own registered project
$inspProject = @((Req GET "$API/projects" $T $null).d) | Where-Object { $_.id -eq $one.d.project_id } | Select-Object -First 1
$geoSame = Req POST "$API/inspections/$($one.d.id)/geo-verify" $T @{ lat=$inspProject.geo_coords.lat; lng=$inspProject.geo_coords.lng }
Check 'geo-verify on-site -> verified' ($geoSame.s -eq 200 -and $geoSame.d.verdict -eq 'verified') "$($geoSame.s) $($geoSame.raw)"
$geoFar = Req POST "$API/inspections/$($one.d.id)/geo-verify" $T @{ lat=($inspProject.geo_coords.lat + 0.5); lng=$inspProject.geo_coords.lng }
Check 'geo-verify far away -> suspicious' ($geoFar.s -eq 200 -and $geoFar.d.verdict -eq 'suspicious') "$($geoFar.s) $($geoSame.raw)"
Check 'geo verdict carries every contract field' (
  $geoFar.d.PSObject.Properties.Name -contains 'distance_meters' -and
  $geoFar.d.PSObject.Properties.Name -contains 'within_radius' -and
  $geoFar.d.PSObject.Properties.Name -contains 'severity' -and
  $geoFar.d.PSObject.Properties.Name -contains 'explanation' -and
  $geoFar.d.PSObject.Properties.Name -contains 'radius_meters') ($geoFar.d.PSObject.Properties.Name -join ',')

# status update by the assigned official
$mineList = @((Req GET "$API/inspections/mine" $TO $null).d)
if ($mineList.Count -gt 0) {
  $target = $mineList[0]
  $bad = Req PUT "$API/inspections/$($target.id)/status" $TO @{ status='nonsense' }
  Check 'PUT /inspections/:id/status rejects an unknown status (400)' ($bad.s -eq 400) "s=$($bad.s)"

  $targetProject = @((Req GET "$API/projects" $T $null).d) | Where-Object { $_.id -eq $target.project_id } | Select-Object -First 1
  $tLat = $targetProject.geo_coords.lat
  $tLng = $targetProject.geo_coords.lng

  $okStatus = Req PUT "$API/inspections/$($target.id)/status" $TO @{ status='completed'; notes='smoke test'; lat=$tLat; lng=$tLng }
  Check 'PUT /inspections/:id/status -> {inspection, geo_verification, flags}' (
    $okStatus.s -eq 200 -and $okStatus.d.inspection -and $okStatus.d.PSObject.Properties.Name -contains 'geo_verification' -and
    $okStatus.d.PSObject.Properties.Name -contains 'flags') "s=$($okStatus.s) $($okStatus.raw)"

  $flagged = Req PUT "$API/inspections/$($target.id)/status" $TO @{ status='completed'; lat=($tLat + 0.6); lng=($tLng + 0.6) }
  Check 'a far-away report auto-flags the inspection' (
    $flagged.s -eq 200 -and $flagged.d.inspection.status -eq 'flagged' -and
    ($flagged.d.flags -contains 'possible_proxy_reporting')) "$($flagged.s) $($flagged.raw)"

  $foreign = @($inspections | Where-Object { $_.assigned_to -ne $mineList[0].assigned_to })
  if ($foreign.Count -gt 0) {
    Check 'an official cannot report on another official inspection (404)' (
      (Req PUT "$API/inspections/$($foreign[0].id)/status" $TO @{ status='completed' }).s -eq 404) 'expected 404'
  }
}

# checklists
if ($newInspId) {
  $cl = Req GET "$API/inspections/$newInspId/checklist" $TO $null
  Check 'GET /inspections/:id/checklist -> items + saved_checks' (
    $cl.s -eq 200 -and $cl.d.scheme -and $cl.d.items.Count -gt 0 -and $null -ne $cl.d.saved_checks) "s=$($cl.s) $($cl.raw)"

  $allItems = @($cl.d.items)
  $checks = @{}
  foreach ($i in $allItems) { $checks[$i.id] = ($i.id -eq $allItems[0].id) }
  $saved = Req POST "$API/inspections/$newInspId/checklist" $TO @{ checks=$checks; voice_remarks='checked on site' }
  Check 'POST /inspections/:id/checklist -> scored record' (
    $saved.s -eq 200 -and $saved.d.record -and $saved.d.record.compliance_score -gt 0) "s=$($saved.s) $($saved.raw)"
  $reread = Req GET "$API/inspections/$newInspId/checklist" $TO $null
  Check 'the saved checklist round-trips' ($reread.d.saved_checks.($allItems[0].id) -eq $true) ($reread.raw)
}

# ----------------------------------------------------------------- evidence
$evList = Req GET "$API/evidence?inspection_id=$($inspections[0].id)" $T $null
Check 'GET /evidence?inspection_id= -> array' ($evList.s -eq 200) "s=$($evList.s)"
$allEv = Req GET "$API/evidence" $T $null
$unverified = @($allEv.d) | Where-Object { $_.verified -eq $false } | Select-Object -First 1
if ($unverified) {
  $v = Req PUT "$API/evidence/$($unverified.id)/verify" $T $null
  Check 'PUT /evidence/:id/verify -> verified' ($v.s -eq 200 -and $v.d.verified -eq $true) "s=$($v.s) $($v.raw)"
  Check 'PUT /evidence/:id/verify as official -> 403' ((Req PUT "$API/evidence/$($unverified.id)/verify" $TO $null).s -eq 403) 'expected 403'
}

Write-Host ''
Write-Host ("SUBTOTAL  pass={0}  fail={1}" -f $script:pass, $script:fail)
if ($script:fail) { $script:fails | ForEach-Object { Write-Host "  - $_" } }
