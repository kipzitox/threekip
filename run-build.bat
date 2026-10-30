@echo off
REM Local debug APK build helper (Windows).
REM Requires JDK 17 and the Android SDK. Nothing here is machine-specific:
REM set ANDROID_HOME / JAVA_HOME in your environment, or rely on the default
REM Android Studio SDK location and the JDK on PATH.
REM Run from anywhere; paths resolve from this script's folder.

if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"

cd /d "%~dp0android"
call gradlew.bat assembleDebug --no-daemon > "%~dp0build-debug.log" 2>&1
echo BUILD_EXITCODE=%ERRORLEVEL% >> "%~dp0build-debug.log"
