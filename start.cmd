@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   王睿 · 个人主页  —— 本地预览服务
echo ============================================
echo.
node server.js %1
echo.
echo 服务已退出。
pause
