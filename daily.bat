@echo off
rem Coleta diária local: Kp/aurora (NOAA), tempo/satélite e panorama global (Open-Meteo, NASA GIBS).
cd /d "%~dp0"
node collect-daily.mjs
pause
