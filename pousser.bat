@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title ZILCH - envoi sur GitHub
cd /d "%~dp0"

echo.
echo ==========================================================
echo    ZILCH - envoi des modifications sur GitHub
echo ==========================================================
echo.

rem ---------------------------------------------------------------
rem 1. Trouver git : sur le PATH, sinon celui livre avec GitHub Desktop,
rem    sinon Git pour Windows.
rem ---------------------------------------------------------------
set "GIT="
where git >nul 2>&1 && set "GIT=git"

if not defined GIT (
  for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
    if exist "%%D\resources\app\git\cmd\git.exe" set "GIT=%%D\resources\app\git\cmd\git.exe"
  )
)
set "PF32=%ProgramFiles(x86)%"
if not defined GIT if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if not defined GIT if exist "!PF32!\Git\cmd\git.exe" set "GIT=!PF32!\Git\cmd\git.exe"

if not defined GIT (
  echo [ECHEC] git est introuvable sur cette machine.
  echo         Ouvre GitHub Desktop et pousse depuis la,
  echo         ou installe Git pour Windows : https://git-scm.com/download/win
  echo.
  pause
  exit /b 1
)
echo git utilise : !GIT!
echo.

rem ---------------------------------------------------------------
rem 2. Y a-t-il quelque chose a envoyer ?
rem ---------------------------------------------------------------
echo --- Fichiers modifies ---
"!GIT!" status --short
echo.

set "CHANGES="
for /f "delims=" %%L in ('"!GIT!" status --porcelain') do set "CHANGES=1"
if not defined CHANGES (
  echo Rien a envoyer : le dossier est deja a jour.
  echo.
  pause
  exit /b 0
)

rem ---------------------------------------------------------------
rem 3. Tests, si Node est installe. Un test rouge arrete tout.
rem ---------------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 (
  echo Node absent : tests ignores.
  echo.
) else (
  echo --- Tests ---
  call npm test
  if errorlevel 1 (
    echo.
    echo [ARRET] Des tests echouent. RIEN n'a ete envoye.
    echo.
    pause
    exit /b 1
  )
  echo.
)

rem ---------------------------------------------------------------
rem 4. Commit et envoi
rem ---------------------------------------------------------------
"!GIT!" add -A
if errorlevel 1 ( echo [ECHEC] git add. & pause & exit /b 1 )

"!GIT!" commit -m "Lot 6 : l'ecran de partie tient reellement sur un iPhone" -m "Barre d'action fixe, pave numerique maison, --nav-h soustraite de la hauteur. Mesure sur vrais viewports iPhone : Z, Z+ et Essai rate etaient interceptes par la barre de navigation, Valider etait cache par le clavier sur tous les modeles. 140 tests au vert. Service worker en zilch-v8."
if errorlevel 1 (
  echo.
  echo [ECHEC] Le commit a echoue.
  echo         Si git dit "Please tell me who you are", lance ces deux lignes puis relance :
  echo            "!GIT!" config --global user.name "Ted"
  echo            "!GIT!" config --global user.email "teddypereira88@gmail.com"
  echo.
  pause
  exit /b 1
)

echo.
echo --- Envoi vers GitHub ---
"!GIT!" push origin main
if errorlevel 1 (
  echo.
  echo [ECHEC] L'envoi a echoue.
  echo         Cause la plus frequente : identifiants GitHub absents.
  echo         Ouvre GitHub Desktop une fois, connecte-toi a ton compte,
  echo         ferme-le, puis relance ce script.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo    ENVOYE.
echo.
echo    L'application se met a jour toute seule sur ton iPhone
echo    dans la minute qui suit - le cache passe en zilch-v8.
echo.
echo    https://professeurt.github.io/zilch-app/
echo ==========================================================
echo.
pause
