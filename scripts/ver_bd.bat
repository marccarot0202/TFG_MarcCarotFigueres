@echo off
setlocal
cd /d "%~dp0"

echo =========================================
echo Visor local de base de datos TFG
echo =========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta disponible en PATH.
  echo Abre este .bat desde una consola donde nvm/node ya este activo.
  pause
  exit /b 1
)

if "%~1"=="" (
  node "%~dp0view_db.js" overview
) else (
  node "%~dp0view_db.js" %*
)

echo.
echo =========================================
echo Comandos utiles:
echo   ver_bd.bat overview
echo   ver_bd.bat tables
echo   ver_bd.bat schema known_addresses
echo   ver_bd.bat table known_addresses 20
echo   ver_bd.bat search 0x0059b14e35dab1b4eee1e2926c7a5660da66f747
echo =========================================
pause
