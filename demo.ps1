$global:G = "http://localhost:3000"
function global:body($s) { Set-Content -Path "$env:TEMP\b.json" -Value $s -NoNewline -Encoding ascii; "@$env:TEMP\b.json" }
function global:r($m, $path, $tok, $dev, $json) {
    $a = @("-s", "-w", "`n-> HTTP %{http_code}`n", "-X", $m, "$global:G$path")
    if ($tok) { $a += @("-H", "Authorization: Bearer $tok") }
    if ($dev) { $a += @("-H", "X-Device-ID: dev-$dev") }
    if ($json) { $a += @("-H", "Content-Type: application/json", "-d", (body $json)) }
    curl.exe @a
}
function global:login($u) { curl.exe -s -X POST "$global:G/auth/login" -H "Content-Type: application/json" -H "X-Device-ID: dev-$u" -d (body ('{"username":"' + $u + '","password":"password123"}')) }
function global:tk($u) { (login $u | ConvertFrom-Json).access_token }
$global:D1 = tk dosen1; $global:D2 = tk dosen2; $global:M1 = tk mhs1; $global:AD = tk admin1
Write-Host "Siap. D1 = $($global:D1.Substring(0,15))..." -ForegroundColor Green