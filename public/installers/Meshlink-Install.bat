@echo off
title Meshlink Installer
color 0A
echo.
echo  ========================================
echo     Meshlink - Decentralized Messenger
echo  ========================================
echo.
echo  Installing Meshlink...
echo.

:: Create app directory
mkdir "%USERPROFILE%\Meshlink" 2>nul

:: Detect server URL from where this was downloaded
:: Default to localhost if unknown
set "SERVER_URL=http://72.56.244.207"

:: Create launcher bat
echo @echo off > "%USERPROFILE%\Meshlink\Meshlink.bat"
echo start "" "%SERVER_URL%" >> "%USERPROFILE%\Meshlink\Meshlink.bat"

:: Create VBS helper to make a proper shortcut with icon
echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\meshlink_shortcut.vbs"
echo Set shortcut = ws.CreateShortcut(ws.SpecialFolders("Desktop") ^& "\Meshlink.lnk") >> "%TEMP%\meshlink_shortcut.vbs"
echo shortcut.TargetPath = "%USERPROFILE%\Meshlink\Meshlink.bat" >> "%TEMP%\meshlink_shortcut.vbs"
echo shortcut.IconLocation = "shell32.dll,14" >> "%TEMP%\meshlink_shortcut.vbs"
echo shortcut.Description = "Meshlink - Decentralized Messenger" >> "%TEMP%\meshlink_shortcut.vbs"
echo shortcut.WindowStyle = 7 >> "%TEMP%\meshlink_shortcut.vbs"
echo shortcut.Save >> "%TEMP%\meshlink_shortcut.vbs"

:: Run VBS to create shortcut
cscript //nologo "%TEMP%\meshlink_shortcut.vbs"
del "%TEMP%\meshlink_shortcut.vbs"

:: Also create Start Menu shortcut
mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Meshlink" 2>nul
echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\meshlink_start.vbs"
echo Set shortcut = ws.CreateShortcut("%APPDATA%\Microsoft\Windows\Start Menu\Programs\Meshlink\Meshlink.lnk") >> "%TEMP%\meshlink_start.vbs"
echo shortcut.TargetPath = "%USERPROFILE%\Meshlink\Meshlink.bat" >> "%TEMP%\meshlink_start.vbs"
echo shortcut.IconLocation = "shell32.dll,14" >> "%TEMP%\meshlink_start.vbs"
echo shortcut.Description = "Meshlink - Decentralized Messenger" >> "%TEMP%\meshlink_start.vbs"
echo shortcut.Save >> "%TEMP%\meshlink_start.vbs"
cscript //nologo "%TEMP%\meshlink_start.vbs"
del "%TEMP%\meshlink_start.vbs"

echo.
echo  ========================================
echo   Installation complete!
echo.
echo   - Desktop shortcut created
echo   - Start Menu entry created
echo   - Opening Meshlink now...
echo  ========================================
echo.

:: Open the app
start "" "%SERVER_URL%"

timeout /t 5
