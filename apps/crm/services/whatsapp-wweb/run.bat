@echo off
REM Windows CMD: define as variaveis e inicia o servico
REM Uso: run.bat
REM Ou: set TENANT_ID=uuid & run.bat

if "%PORT%"=="" set PORT=4100
if "%CRM_URL%"=="" set CRM_URL=http://localhost:3000
if "%TENANT_ID%"=="" (
  echo Defina TENANT_ID. Ex: set TENANT_ID=uuid-do-tenant ^& run.bat
  echo Ou crie .env com TENANT_ID=uuid e rode: npm start
  exit /b 1
)
node index.js
