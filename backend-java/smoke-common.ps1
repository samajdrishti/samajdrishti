$ErrorActionPreference = 'Continue'
$API = 'http://localhost:5000/api'
$script:pass = 0
$script:fail = 0
$script:fails = @()

function Req($m, $u, $t, $b) {
  $h = @{}; if ($t) { $h.Authorization = "Bearer $t" }
  $p = $null
  if ($b -ne $null) { $p = ConvertTo-Json $b -Depth 10; $h['Content-Type'] = 'application/json' }
  try {
    $r = Invoke-WebRequest -Uri $u -Method $m -Headers $h -Body $p -UseBasicParsing -TimeoutSec 40
    $d = $null
    try { $d = $r.Content | ConvertFrom-Json } catch { $d = $r.Content }
    return @{ s = $r.StatusCode; d = $d; raw = $r.Content }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $sr = New-Object IO.StreamReader($resp.GetResponseStream())
      $c = $sr.ReadToEnd()
      $d = $null; try { $d = $c | ConvertFrom-Json } catch { $d = $c }
      return @{ s = [int]$resp.StatusCode; d = $d; raw = $c }
    }
    return @{ s = 0; d = $_.Exception.Message; raw = '' }
  }
}

function Check($name, $ok, $detail = '') {
  if ($ok) { $script:pass++; Write-Host ("PASS  {0}" -f $name) }
  else { $script:fail++; $script:fails += "$name :: $detail"; Write-Host ("FAIL  {0} :: {1}" -f $name, $detail) -ForegroundColor Red }
}

function Login($email, $password) {
  $r = Req POST "$API/auth/login" $null @{ email = $email; password = $password }
  if ($r.s -eq 200 -and $r.d.token) { return $r.d.token } else { return $null }
}
