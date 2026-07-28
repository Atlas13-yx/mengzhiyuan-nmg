@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在准备“蒙志愿”本地预览，请稍候...

if not exist "node_modules" (
  call npm install
  if errorlevel 1 goto :failed
)

call npm run build
if errorlevel 1 goto :failed

start "蒙志愿本地服务" cmd /k "cd /d ""%~dp0"" && npm run start"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:3000"
exit /b 0

:failed
echo.
echo 启动失败，请保留本窗口中的错误信息并发给 Codex。
pause
exit /b 1
