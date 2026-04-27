$ps = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"

$docker = Start-Process $ps -PassThru -ArgumentList '-NoExit', '-Command', 'docker compose -f docker-compose.dev.yml up --build'
$frontend = Start-Process $ps -PassThru -ArgumentList '-NoExit', '-Command', 'cd ".\Coffer\Coffer.ReactNative"; npm run android'

$infoScript = @'
Write-Host "================ PROJECT INFO ================" -ForegroundColor Cyan

Write-Host "`n.NET API" -ForegroundColor Yellow
Write-Host "  Base URL:   http://localhost:5141"
Write-Host "  Swagger:    http://localhost:5141/swagger"

Write-Host "`nPython Service" -ForegroundColor Yellow
Write-Host "  Base URL:   http://localhost:8000"
Write-Host "  Test:       http://localhost:8000/hello"

Write-Host "`nPostgreSQL" -ForegroundColor Yellow
Write-Host "  Host:       localhost"
Write-Host "  Port:       5432"
Write-Host "  User:       postgres"

Write-Host "`n==============================================" -ForegroundColor Cyan
'@

Start-Process $ps -ArgumentList '-NoExit', '-Command', $infoScript

Wait-Process -Id $docker.Id, $frontend.Id