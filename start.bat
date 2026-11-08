@echo off
rem Abre o MagneTerra localmente (sem login, sem ChatGPT).
rem Sobe o servidor numa janela minimizada, espera ele ficar pronto e só então abre o navegador.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)
start "MagneTerra - servidor (feche esta janela para parar)" /min cmd /c node serve.mjs
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:4173/"
echo MagneTerra aberto em http://127.0.0.1:4173/
echo Para parar o servidor, feche a janela minimizada "MagneTerra - servidor".
timeout /t 5 >nul
