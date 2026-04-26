$ps = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"

Start-Process $ps -ArgumentList '-NoExit', '-Command', 'docker compose -f docker-compose.dev.yml up --build'

Start-Process $ps -ArgumentList '-NoExit', '-Command', 'cd ".\Coffer\Coffer.ReactNative"; npm run android'