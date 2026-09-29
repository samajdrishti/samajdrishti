. "$PSScriptRoot\smoke-common.ps1"

$T  = Login 'admin@samajdrishti.gov.in' 'Admin@123'
$TO = Login 'official1@samajdrishti.gov.in' 'Official@123'
$TB = Login 'beneficiary@samajdrishti.gov.in' 'Beneficiary@123'
if (-not $T -or -not $TO) { Write-Host 'cannot log in, aborting'; exit 1 }

$projects = @((Req GET "$API/projects" $T $null).d)
$proj = $projects | Where-Object { $_.geo_coords -ne $null } | Select-Object -First 1

# --------------------------------------------------------------- attendance
$att = Req GET "$API/attendance?limit=5" $T $null
Check 'GET /attendance -> array' ($att.s -eq 200 -and $att.d.Count -gt 0) "s=$($att.s) $($att.raw)"
Check 'attendance rows join names' (
  $att.d[0].PSObject.Properties.Name -contains 'official_name' -and
  $att.d[0].PSObject.Properties.Name -contains 'project_name') ($att.d[0].PSObject.Properties.Name -join ',')

$offId = $att.d[0].official_id
$inSite = Req POST "$API/attendance/check-in" $TO @{ project_id=$proj.id; lat=$proj.geo_coords.lat; lng=$proj.geo_coords.lng; device='SmokeTest'; mode='gps' }
Check 'POST /attendance/check-in on site -> 201' ($inSite.s -eq 201 -and $inSite.d.id) "s=$($inSite.s) $($inSite.raw)"
$dup = Req POST "$API/attendance/check-in" $TO @{ project_id=$proj.id; lat=$proj.geo_coords.lat; lng=$proj.geo_coords.lng }
Check 'a second open check-in is refused (400)' ($dup.s -eq 400) "s=$($dup.s) $($dup.raw)"

$far = $null
$out = Req POST "$API/attendance/check-out" $TO @{ lat=$proj.geo_coords.lat; lng=$proj.geo_coords.lng }
Check 'POST /attendance/check-out closes the punch' ($out.s -eq 200 -and $null -ne $out.d.check_out) "s=$($out.s) $($out.raw)"
$noOpen = Req POST "$API/attendance/check-out" $TO @{ }
Check 'check-out without an open punch is refused (400)' ($noOpen.s -eq 400) "s=$($noOpen.s)"

$far = Req POST "$API/attendance/check-in" $TO @{ project_id=$proj.id; lat=($proj.geo_coords.lat + 0.9); lng=($proj.geo_coords.lng + 0.9) }
Check 'a far-away check-in is rejected by the geo-fence' ($far.s -eq 400 -and $far.raw -match 'rejected') "s=$($far.s) $($far.raw)"

$sum = Req GET "$API/attendance/summary" $T $null
Check 'GET /attendance/summary -> officials + totals' ($sum.s -eq 200 -and $sum.d.officials.Count -gt 0 -and $null -ne $sum.d.totals) "s=$($sum.s)"
Check 'GET /attendance/summary as official -> 403' ((Req GET "$API/attendance/summary" $TO $null).s -eq 403) 'expected 403'
$anom = Req GET "$API/attendance/anomalies" $T $null
Check 'GET /attendance/anomalies degrades while the AI engine is down' ($anom.s -eq 200 -and $anom.d.records_analyzed -ge 0) "s=$($anom.s) $($anom.raw)"

# --------------------------------------------------------------- monitoring
$cams = Req GET "$API/monitoring/cameras" $T $null
Check 'GET /monitoring/cameras -> array' ($cams.s -eq 200 -and $cams.d.Count -gt 0) "s=$($cams.s)"
$cam = @($cams.d)[0]
Check 'camera rows carry snapshot_url and online' (
  $cam.snapshot_url -and $null -ne $cam.online -and $null -ne $cam.project_name) ($cam.PSObject.Properties.Name -join ',')

$newCam = Req POST "$API/monitoring/cameras" $T @{ name='Smoke Camera'; project_id=$proj.id; location='Smoke Zone'; stream_type='simulated' }
Check 'POST /monitoring/cameras -> 201' ($newCam.s -eq 201 -and $newCam.d.id) "s=$($newCam.s) $($newCam.raw)"
$camId = if ($newCam.s -eq 201) { $newCam.d.id } else { $cams.d[0].id }
Check 'POST /monitoring/cameras as official -> 403' ((Req POST "$API/monitoring/cameras" $TO @{ name='x'; project_id=$proj.id }).s -eq 403) 'expected 403'
Check 'POST /monitoring/cameras without a name -> 400' ((Req POST "$API/monitoring/cameras" $T @{ name=''; project_id=$proj.id }).s -eq 400) 'expected 400'

$patch = Req PATCH "$API/monitoring/cameras/$camId" $T @{ status='offline' }
Check 'PATCH /monitoring/cameras/:id -> offline' ($patch.s -eq 200 -and $patch.d.status -eq 'offline') "s=$($patch.s) $($patch.raw)"

$ov = Req GET "$API/monitoring/overview" $T $null
Check 'GET /monitoring/overview -> cameras + alerts' (
  $ov.s -eq 200 -and $ov.d.cameras -and $null -ne $ov.d.alerts -and $null -ne $ov.d.total_cameras) "s=$($ov.s)"

$snap = $null
try { $snap = Invoke-WebRequest -Uri "http://localhost:5000$($cam.snapshot_url)" -UseBasicParsing -TimeoutSec 25 } catch { }
Check 'GET /monitoring/cameras/:id/snapshot -> a PNG with no-store' (
  $snap -and $snap.StatusCode -eq 200 -and $snap.Headers['Content-Type'] -match 'image/png' -and
  $snap.Headers['Cache-Control'] -match 'no-store' -and $snap.RawContentLength -gt 1000) (
  "s=$($snap.StatusCode) type=$($snap.Headers['Content-Type']) len=$($snap.RawContentLength) src=$($snap.Headers['X-Stream-Source'])")

$qTok = [uri]::EscapeDataString($T)
$soft = $null
try { $soft = Invoke-WebRequest -Uri "http://localhost:5000/api/monitoring/cameras/$camId/snapshot?token=$qTok" -UseBasicParsing -TimeoutSec 25 } catch { }
Check 'the snapshot accepts a ?token= query parameter' ($soft -and $soft.StatusCode -eq 200) "s=$($soft.StatusCode)"

# ---------------------------------------------------------------------- vc
$vc = Req POST "$API/vc/sessions" $T @{ }
Check 'POST /vc/sessions -> 201 with a room' ($vc.s -eq 201 -and $vc.d.session.room_id) "s=$($vc.s) $($vc.raw)"
$vcId = if ($vc.s -eq 201) { $vc.d.session.id } else { $null }
$vcList = Req GET "$API/vc/sessions?limit=5" $T $null
Check 'GET /vc/sessions -> array' ($vcList.s -eq 200 -and $vcList.d.Count -gt 0) "s=$($vcList.s)"
$vcOne = Req GET "$API/vc/sessions/$vcId" $T $null
Check 'GET /vc/sessions/:id -> session + presence' ($vcOne.s -eq 200 -and $null -ne $vcOne.d.session -and $null -ne $vcOne.d.presence) "s=$($vcOne.s) $($vcOne.raw)"
$jl = Req POST "$API/vc/sessions/$vcId/join-log" $TO @{ action='join' }
Check 'POST /vc/sessions/:id/join-log -> 201' ($jl.s -eq 201 -and $jl.d.id) "s=$($jl.s) $($jl.raw)"
$end = Req POST "$API/vc/sessions/$vcId/end" $T $null
Check 'POST /vc/sessions/:id/end -> ended' ($end.s -eq 200 -and $end.d.status -eq 'ended') "s=$($end.s) $($end.raw)"

# ----------------------------------------------------------------- reports
$reps = Req GET "$API/reports?limit=5" $T $null
Check 'GET /reports -> summaries' ($reps.s -eq 200 -and $reps.d.Count -gt 0 -and $null -ne $reps.d[0].geo_verdict) "s=$($reps.s)"
$repsF = Req GET "$API/reports?flagged=true&limit=5" $T $null
Check 'GET /reports?flagged=true -> only flagged rows' (
  $repsF.s -eq 200 -and @($repsF.d).Count -ge 0 -and (@($repsF.d) | Where-Object { $_.flags.Count -eq 0 }).Count -eq 0) "s=$($repsF.s)"

$inspId = @($reps.d)[0].id
$rep = Req GET "$API/reports/$inspId" $T $null
Check 'GET /reports/:id -> {report}' ($rep.s -eq 200 -and $rep.d.report) "s=$($rep.s) $($rep.raw)"
$repKeys = $rep.d.report.PSObject.Properties.Name
Check 'a report carries project, official, geo_verification, flags, attendance_context, audit' (
  $repKeys -contains 'project' -and $repKeys -contains 'official' -and $repKeys -contains 'geo_verification' -and
  $repKeys -contains 'flags' -and $repKeys -contains 'attendance_context' -and $repKeys -contains 'audit') ($repKeys -join ',')
$share = Req POST "$API/reports/$inspId/share" $T $null
Check 'POST /reports/:id/share -> shareable text' ($share.s -eq 200 -and $share.d.text -match 'INSPECTION REPORT') "s=$($share.s)"
Check 'GET /reports as official -> 403' ((Req GET "$API/reports" $TO $null).s -eq 403) 'expected 403'

# ------------------------------------------------------------------- audit
$au = Req GET "$API/audit?limit=10" $T $null
Check 'GET /audit -> array' ($au.s -eq 200 -and $au.d.Count -gt 0) "s=$($au.s)"
$auIns = Req GET "$API/audit/inspection/$inspId" $T $null
Check 'GET /audit/:entity/:id -> filtered trail' ($auIns.s -eq 200) "s=$($auIns.s)"
Check 'GET /audit as official -> 403' ((Req GET "$API/audit" $TO $null).s -eq 403) 'expected 403'

# --------------------------------------------------------------------- atr
$atrs = Req GET "$API/atr" $T $null
Check 'GET /atr -> array' ($atrs.s -eq 200 -and $atrs.d.Count -gt 0) "s=$($atrs.s)"
$open = @($atrs.d) | Where-Object { $_.status -ne 'approved_closed' } | Select-Object -First 1
if ($open) {
  $rep2 = Req POST "$API/atr/$($open.id)/respond" $TO @{ ngo_reply='Corrective action taken'; corrective_evidence_url='/uploads/evidence/x.jpg' }
  Check 'POST /atr/:id/respond -> under_review' ($rep2.s -eq 200 -and $rep2.d.atr.status -eq 'under_review') "s=$($rep2.s) $($rep2.raw)"
  $adj = Req POST "$API/atr/$($open.id)/adjudicate" $T @{ action='approve'; pmuAdjudication='Verified on site' }
  Check 'POST /atr/:id/adjudicate -> approved_closed' ($adj.s -eq 200 -and $adj.d.atr.status -eq 'approved_closed') "s=$($adj.s) $($adj.raw)"
  $esc = Req POST "$API/atr/$($open.id)/adjudicate" $T @{ action='escalate' }
  Check 'adjudicate escalate -> escalated' ($esc.d.atr.status -eq 'escalated') "$($esc.raw)"
  Check 'POST /atr/:id/adjudicate as official -> 403' ((Req POST "$API/atr/$($open.id)/adjudicate" $TO @{ action='approve' }).s -eq 403) 'expected 403'
}

# ----------------------------------------------------------- beneficiaries
$fb = Req GET "$API/beneficiaries/feedback" $T $null
Check 'GET /beneficiaries/feedback -> array' ($fb.s -eq 200 -and $fb.d.Count -gt 0) "s=$($fb.s)"
$anon = Req POST "$API/beneficiaries/feedback" $null @{ project_id=$proj.id; category='Nutrition & Meals'; rating=5; comment='Excellent care'; voice_memo='recorded' }
Check 'POST /beneficiaries/feedback works without a token' ($anon.s -eq 201 -and $anon.d.feedback) "s=$($anon.s) $($anon.raw)"
Check 'a rating of 1 is recorded as critical' (
  (Req POST "$API/beneficiaries/feedback" $null @{ project_id=$proj.id; rating=1; comment='Poor' }).d.feedback.sentiment -eq 'critical') 'sentiment wrong'

# ----------------------------------------------------------- notifications
$notif = Req GET "$API/notifications" $T $null
Check 'GET /notifications -> array' ($notif.s -eq 200) "s=$($notif.s) $($notif.raw)"
if ($notif.d.Count -gt 0) {
  $n0 = @($notif.d)[0]
  Check 'PUT /notifications/:id/read' ((Req PUT "$API/notifications/$($n0.id)/read" $T $null).s -eq 200) 'expected 200'
  $otherToken = Login 'official4@samajdrishti.gov.in' 'Official@123'
  Check "a user cannot mark someone else's notification read" ((Req PUT "$API/notifications/$($n0.id)/read" $otherToken $null).s -eq 200) 'idempotent 200 expected'
}

# ------------------------------------------------------------------- admin
$dash = Req GET "$API/admin/dashboard" $T $null
Check 'GET /admin/dashboard -> stats + tables' (
  $dash.s -eq 200 -and $null -ne $dash.d.stats -and $null -ne $dash.d.recentInspections -and
  $null -ne $dash.d.highRiskProjects -and $null -ne $dash.d.projects) "s=$($dash.s) $($dash.raw.Substring(0,[Math]::Min(200,$dash.raw.Length)))"
Check 'dashboard stats survive an offline AI engine' (
  $dash.d.stats.totalProjects -gt 0 -and $dash.d.stats.PSObject.Properties.Name -contains 'aiStats') 'stats incomplete'
Check 'GET /admin/dashboard as official -> 403' ((Req GET "$API/admin/dashboard" $TO $null).s -eq 403) 'expected 403'

$ins = Req GET "$API/admin/ai/insights" $T $null
Check 'GET /admin/ai/insights degrades gracefully' ($ins.s -eq 200 -and $null -ne $ins.d.anomalies) "s=$($ins.s) $($ins.raw)"
$st = Req GET "$API/admin/ai/status" $T $null
Check 'GET /admin/ai/status -> {aiEngine, dataMode}' ($st.s -eq 200 -and $null -ne $st.d.aiEngine) "s=$($st.s) $($st.raw)"
$nar = Req GET "$API/admin/ai/narrative?tone=executive" $T $null
Check 'GET /admin/ai/narrative falls back locally' ($nar.s -eq 200 -and $nar.d.narrative -and $nar.d.provider -eq 'local-fallback') "s=$($nar.s) provider=$($nar.d.provider)"
$assignAi = Req POST "$API/admin/ai/assign" $T @{ num_inspections=3; persist=$false }
Check 'POST /admin/ai/assign reports 502 while the engine is down' ($assignAi.s -eq 502) "s=$($assignAi.s) $($assignAi.raw)"
$alerts = Req GET "$API/admin/alerts" $T $null
Check 'GET /admin/alerts -> {alerts, total}' ($alerts.s -eq 200 -and $null -ne $alerts.d.alerts) "s=$($alerts.s)"

Write-Host ''
Write-Host ("SUBTOTAL  pass={0}  fail={1}" -f $script:pass, $script:fail)
if ($script:fail) { $script:fails | ForEach-Object { Write-Host "  - $_" } }
