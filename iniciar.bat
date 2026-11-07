@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
chcp 65001 >nul
title Dilatacion termica

:: Puerto propio de este proyecto.
:: No usa 3000 (IA local), 3001 ni 4000 (LearnCode), ni el puerto del POS.
set "PORT=8765"

echo.
echo  ========================================
echo   Dilatacion termica
echo  ========================================
echo  Carpeta: %CD%
echo.

where py >nul 2>&1 && (
  set "PY=py"
) || (
  where python >nul 2>&1 && (
    set "PY=python"
  ) || (
    echo [ERROR] No se encontro Python.
    echo         Instala Python y volve a abrir este archivo.
    pause
    exit /b 1
  )
)

rem #region agent log
set "DBG_H=H3"
set "DBG_MSG=python elegido"
set "DBG_DATA=py=%PY%"
call :log
rem #endregion

call :estado %PORT%
set "EST=%ERRORLEVEL%"
rem #region agent log
set "DBG_H=H1"
set "DBG_MSG=estado puerto inicial"
set "DBG_DATA=port=%PORT% code=%EST%"
call :log
rem #endregion
if %EST% GEQ 10 (
  rem #region agent log
  set "DBG_H=H4"
  set "DBG_MSG=rama ya corriendo"
  set "DBG_DATA=port=%PORT% code=%EST%"
  call :log
  rem #endregion
  echo  Ya esta corriendo en http://127.0.0.1:%PORT%/
  echo  No se abrio otro servidor.
  start "" "http://127.0.0.1:%PORT%/"
  echo.
  pause
  exit /b 0
)
if %EST% GEQ 1 goto :arrancar

echo  El puerto %PORT% esta ocupado por otro programa.
echo  Buscando uno libre entre 8766 y 8775...
set "PORT="
for %%P in (8766 8767 8768 8769 8770 8771 8772 8773 8774 8775) do (
  if not defined PORT (
    call :estado %%P
    set "SCANRC=!ERRORLEVEL!"
    rem #region agent log
    set "DBG_H=H5"
    set "DBG_MSG=estado puerto alterno"
    set "DBG_DATA=port=%%P code=!SCANRC!"
    call :log
    rem #endregion
    if !SCANRC! EQU 1 set "PORT=%%P"
  )
)
if not defined PORT (
  rem #region agent log
  set "DBG_H=H5"
  set "DBG_MSG=sin puerto libre"
  set "DBG_DATA=range=8766-8775"
  call :log
  rem #endregion
  echo [ERROR] No quedo un puerto libre en 8765-8775.
  pause
  exit /b 1
)

:arrancar
rem #region agent log
set "DBG_H=H1"
set "DBG_MSG=arrancar servidor"
set "DBG_DATA=port=%PORT% py=%PY%"
call :log
rem #endregion
echo  Pagina: http://127.0.0.1:%PORT%/
echo  Cerra esta ventana para detenerla.
echo.
start "" /b cmd /c "ping -n 2 127.0.0.1 >nul & start http://127.0.0.1:%PORT%/"
"%PY%" -m http.server %PORT% --bind 127.0.0.1
set "SRV=%ERRORLEVEL%"
rem #region agent log
set "DBG_H=H3"
set "DBG_MSG=servidor termino"
set "DBG_DATA=port=%PORT% py=%PY% code=%SRV%"
call :log
rem #endregion
echo.
echo El servidor se cerro.
pause
exit /b 0

:: 10 = esta misma pagina ya responde
::  1 = el puerto esta libre
::  0 = el puerto lo usa otro programa
:estado
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%~1/' -UseBasicParsing -TimeoutSec 2; if ($r.Content -like '*Dilataci*') { exit 10 }; exit 0 } catch { exit 1 }"
set "ESTADO_RC=%ERRORLEVEL%"
rem #region agent log
set "DBG_H=H2"
set "DBG_MSG=powershell estado"
set "DBG_DATA=arg=%~1 raw=%ESTADO_RC%"
call :log
rem #endregion
exit /b %ESTADO_RC%

:log
python -c "import json,os,time; p=r'c:\Users\isaac\Documents\Fisica proyecto\.cursor\debug-303b18.log'; open(p,'a',encoding='utf-8').write(json.dumps({'sessionId':'303b18','runId':'pre','hypothesisId':os.environ.get('DBG_H'),'location':'iniciar.bat','message':os.environ.get('DBG_MSG'),'data':os.environ.get('DBG_DATA'),'timestamp':int(time.time()*1000)})+'\n')"
goto :eof
