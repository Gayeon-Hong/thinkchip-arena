@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 토스 콘솔에서 받은 mTLS_인증서_*.zip 을 풀어서 toss-mtls 폴더에 넣고 실행하세요 (*_public.crt, *_private.key)
rem 개인 키는 이 PC → Cloudflare 로만 가요. 채팅이나 GitHub 에 올리지 마세요. (toss-mtls 폴더는 git 에서 제외돼 있어요)
set CRT=
set KEY=
for %%f in (toss-mtls\*_public.crt) do set CRT=%%f
for %%f in (toss-mtls\*_private.key) do set KEY=%%f
if "%CRT%"=="" ( echo toss-mtls 폴더에 *_public.crt 파일이 없어요. & pause & exit /b 1 )
if "%KEY%"=="" ( echo toss-mtls 폴더에 *_private.key 파일이 없어요. & pause & exit /b 1 )
cd live-server
call npx --yes wrangler@4 mtls-certificate upload --cert "..\%CRT%" --key "..\%KEY%" --name thinkchip-toss
echo.
echo 위에 나온 ID (certificate ID) 를 Claude 에게 알려 주세요. 이 ID 는 비밀이 아니에요.
pause
