@echo off
setlocal

echo =========================================
echo Iniciando entorno completo TFG
echo =========================================

set "NVM_HOME=C:\Users\marcc\AppData\Local\nvm"
set "NODE_VERSION_ROOT=20.11.1"
set "PROJECT_ROOT=C:\Users\marcc\Desktop\Univ2.0\5-Cinque\SICUE\TFG\tfg_marc_v1"

set "PATH=%NVM_HOME%;%PATH%"

echo Activando Node %NODE_VERSION_ROOT% para raiz y backend...
"%NVM_HOME%\nvm.exe" use %NODE_VERSION_ROOT%

IF ERRORLEVEL 1 (
    echo ERROR: No se pudo activar Node %NODE_VERSION_ROOT%
    pause
    exit /b 1
)

echo Version activa de Node:
node -v

if not exist "%PROJECT_ROOT%" (
    echo ERROR: No existe la ruta del proyecto:
    echo %PROJECT_ROOT%
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\backend" (
    echo ERROR: No existe la carpeta backend:
    echo %PROJECT_ROOT%\backend
    pause
    exit /b 1
)

echo Iniciando Ollama...
start "Ollama" cmd /k "where ollama && ollama serve"

timeout /t 4 /nobreak > nul

echo Iniciando Backend...
start "Backend" cmd /k "cd /d ""%PROJECT_ROOT%\backend"" && node -v && where node && node server.js"

timeout /t 4 /nobreak > nul

echo Iniciando DApp + Snap...
start "DApp + Snap" cmd /k "cd /d ""%PROJECT_ROOT%"" && node -v && where node && yarn start"

echo =========================================
echo Todo lanzado correctamente
echo =========================================
pause