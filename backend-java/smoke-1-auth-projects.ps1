. "$PSScriptRoot\smoke-common.ps1"

# ------------------------------------------------------------------ system
$root = Req GET 'http://localhost:5000/' $null $null
Check 'GET / -> 200 + dataMode' ($root.s -eq 200 -and $root.d.dataMode) "s=$($root.s) $($root.raw)"

$health = Req GET "$API/health" $null $null
Check 'GET /api/health -> 200 ok' ($health.s -eq 200 -and $health.d.status -eq 'ok') "s=$($health.s) $($health.raw)"
Check 'GET /api/health reports the active data mode' ($health.d.dataMode -eq 'memory') "dataMode=$($health.d.dataMode)"

# -------------------------------------------------------------------- auth
$T  = Login 'admin@samajdrishti.gov.in' 'Admin@123'
$TS = Login 'supervisor@samajdrishti.gov.in' 'Super@123'
$TO = Login 'official1@samajdrishti.gov.in' 'Official@123'
Check 'login admin'    ($T -ne $null)  'no token'
Check 'login supervisor' ($TS -ne $null) 'no token'
Check 'login official1' ($TO -ne $null) 'no token'

Check 'login rejects a bad password (400)' ((Req POST "$API/auth/login" $null @{ email='admin@samajdrishti.gov.in'; password='wrong' }).s -eq 400) 'expected 400'
Check 'GET /auth/profile without a token -> 401' ((Req GET "$API/auth/profile").s -eq 401) 'expected 401'

$profile = Req GET "$API/auth/profile" $T $null
Check 'GET /auth/profile -> the caller' ($profile.s -eq 200 -and $profile.d.user.email -eq 'admin@samajdrishti.gov.in') "$($profile.s) $($profile.raw)"

$me = Req GET "$API/auth/login" $T $null
Check 'GET /auth/profile never leaks the password hash' ($profile.raw -notmatch '"password"') 'password present in payload'
$mail = "verify_$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@samajdrishti.gov.in"
$reg = Req POST "$API/auth/register" $null @{ name='Verify Bot'; email=$mail; password='Verify@123'; role='official'; department='Verification' }
Check 'POST /auth/register -> 201 with a token' ($reg.s -eq 201 -and $reg.d.token) "$($reg.s) $($reg.raw)"
Check 'POST /auth/register rejects a duplicate (400)' ((Req POST "$API/auth/register" $null @{ name='Verify Bot'; email=$mail; password='Verify@123' }).s -eq 400) 'expected 400'
$badReg = Req POST "$API/auth/register" $null @{ name='No Email'; email='not-an-email'; password='x' }
Check 'POST /auth/register validates the body (400 + errors)' ($badReg.s -eq 400 -and $badReg.d.errors) "$($badReg.s) $($badReg.raw)"

# ---------------------------------------------------------------- projects
$projects = Req GET "$API/projects" $T $null
Check 'GET /projects -> non-empty array' ($projects.s -eq 200 -and $projects.d.Count -gt 0) "s=$($projects.s) len=$(@($projects.d).Count)"
$first = @($projects.d)[0]
Check 'projects expose snake_case fields' ($null -ne $first.id -and $null -ne $first.name -and $null -ne $first.created_at) ($projects.raw.Substring(0, [Math]::Min(200, $projects.raw.Length)))
Check 'geo_coords is a {lat,lng} object' ($first.geo_coords -and $null -ne $first.geo_coords.lat -and $null -ne $first.geo_coords.lng) 'geo_coords shape wrong'
Check 'project metadata is exposed as an object' ($first.metadata -is [PSCustomObject] -or $null -eq $first.metadata) 'metadata not parsed'
$pid0 = $first.id

$detail = Req GET "$API/projects/$pid0" $T $null
$detailKeys = ($detail.d.PSObject.Properties.Name)
Check 'GET /projects/:id -> project + children' (
    $detail.s -eq 200 -and $detailKeys -contains 'project' -and $detailKeys -contains 'inspections' -and
    $detailKeys -contains 'cameras' -and $detailKeys -contains 'attendance' -and $detailKeys -contains 'evidence'
) "s=$($detail.s) keys=$($detailKeys -join ',')"
Check 'GET /projects/999999 -> 404' ((Req GET "$API/projects/999999" $T $null).s -eq 404) 'expected 404'

$created = Req POST "$API/projects" $T @{ name="Verification Project $(Get-Random)"; description='created by the smoke suite'; location='Verify Zone'; department='Verification'; geo_coords=@{ lat=19.076; lng=72.8777 }; start_date='2026-01-01'; end_date='2026-12-31'; budget=1234567 }
Check 'POST /projects (admin) -> 201' ($created.s -eq 201 -and $created.d.id) "$($created.s) $($created.raw)"
$newPid = if ($created.d.id) { $created.d.id } else { $null }
if ($newPid) {
  $upd = Req PUT "$API/projects/$newPid" $T @{ name='Verification Project (renamed)'; status='in_progress'; budget=2000000 }
  Check 'PUT /projects/:id -> 200' ($upd.s -eq 200 -and $upd.d.name -eq 'Verification Project (renamed)') "$($upd.s) $($upd.raw)"
  $supUpd = Req PUT "$API/projects/$newPid" $TS @{ name='nope' }
  Check 'PUT /projects/:id as supervisor -> 403' ($supUpd.s -eq 403) "s=$($supUpd.s)"
}
Check 'POST /projects as official -> 403' ((Req POST "$API/projects" $TO @{ name='nope'; location='x'; department='x' }).s -eq 403) 'expected 403'

Write-Host ''
Write-Host ("SUBTOTAL  pass={0}  fail={1}" -f $script:pass, $script:fail)
if ($script:fail) { $script:fails | ForEach-Object { Write-Host "  - $_" } }
