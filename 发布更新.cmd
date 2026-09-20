@echo off
chcp 65001 >nul
title Publish wangrui-site
cd /d "%~dp0"

echo ==========================================================
echo   One-click publish
echo   repo: https://github.com/SZHNB886/wangrui
echo   Cloudflare Pages rebuilds automatically after push.
echo ==========================================================
echo.

echo [1/3] staging changes ...
git add -A

git diff --cached --quiet
if %errorlevel%==0 (
  echo.
  echo   Nothing changed - nothing to publish.
  echo.
  pause
  exit /b 0
)

echo.
echo [2/3] committing ...
git commit -m "update %DATE% %TIME%"

echo.
echo [3/3] pushing to GitHub ...
git push

echo.
echo ==========================================================
if %errorlevel%==0 (
  echo   [OK] Pushed. Cloudflare will rebuild in about 30 seconds.
) else (
  echo   [FAILED] See the message above.
)
echo ==========================================================
pause
