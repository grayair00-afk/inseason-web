@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 설치한 뒤 다시 실행해주세요.
  pause
  exit /b 1
)

node scripts\update-web.js

echo.
pause
