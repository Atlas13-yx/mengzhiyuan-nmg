@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 蒙志愿本地预览

echo 正在构建并启动“蒙志愿”本地预览，请稍候...
echo 启动成功后会自动打开浏览器；请保留此窗口。
echo.

call npm run preview -- --open
if errorlevel 1 (
  echo.
  echo 启动失败。请保留本窗口中的错误信息并发送给 Codex。
  pause
  exit /b 1
)
