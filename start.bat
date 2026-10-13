@echo off
if "%OPENAI_API_KEY%"=="" (echo Set OPENAI_API_KEY first & exit /b 1)
node server.js
