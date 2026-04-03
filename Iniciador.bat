@echo off
setlocal

echo =========================================
echo Iniciando entorno completo TFG
echo =========================================

REM --- Configuracion NVM ---
set "NVM_HOME=C:\Users\marcc\AppData\Local\nvm"
set "NODE_VERSION_ROOT=20.11.1"

REM --- Hacer visible nvm en esta sesion ---
set "PATH=%NVM_HOME%;%PATH%"

REM --- Forzar Node correcto para la raiz/backend ---
echo Activando Node %NODE_VERSION_ROOT% para raiz y backend...
"%NVM_HOME%\nvm.exe" use %NODE_VERSION_ROOT%

IF ERRORLEVEL 1 (
    echo ERROR: No se pudo activar Node %NODE_VERSION_ROOT%
    echo Prueba a ejecutar este .bat como administrador.
    pause
    exit /b 1
)

echo Version activa de Node:
node -v

REM --- 1. Iniciar Ollama (puerto 11434) ---
echo Iniciando Ollama...
start "Ollama" cmd /k "ollama serve"

REM Espera para evitar condiciones de carrera
timeout /t 3 /nobreak > nul

REM --- 2. Iniciar Backend (puerto 3000) ---
echo Iniciando Backend...
start "Backend" cmd /k "cd /d C:\Users\marcc\Desktop\Univ2.2\5-Cinque\SICUE\TFG\tfg_marc_v0\backend && node -v && node server.js"

timeout /t 3 /nobreak > nul

REM --- 3. Iniciar DApp + Snap (8000 y 8080) ---
echo Iniciando DApp + Snap...
start "DApp + Snap" cmd /k "cd /d C:\Users\marcc\Desktop\Univ2.2\5-Cinque\SICUE\TFG\tfg_marc_v0 && node -v && yarn start"

echo =========================================
echo Todo lanzado correctamente
echo =========================================