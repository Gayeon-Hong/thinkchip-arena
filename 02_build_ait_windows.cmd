@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js가 없어요. https://nodejs.org 에서 LTS 설치 후 다시 실행하세요. & pause & exit /b 1)
node scripts\release-build.mjs
pause
