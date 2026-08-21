@echo off
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17-hotspot
cd /d C:\project\android
call gradlew.bat assembleDebug --no-daemon > C:\project\build-debug.log 2>&1
echo BUILD_EXITCODE=%ERRORLEVEL% >> C:\project\build-debug.log
