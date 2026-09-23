# PowerShell: define as variáveis e inicia o serviço WhatsApp Web
# Uso: .\run.ps1
#      ou: $env:TENANT_ID="seu-uuid"; .\run.ps1

$env:PORT = if ($env:PORT) { $env:PORT } else { "4100" }
$env:CRM_URL = if ($env:CRM_URL) { $env:CRM_URL } else { "http://localhost:3000" }
# TENANT_ID deve ser definido: $env:TENANT_ID="uuid-do-tenant"

if (-not $env:TENANT_ID) {
  Write-Host "Defina TENANT_ID. Ex: `$env:TENANT_ID=`"uuid-do-tenant`"; .\run.ps1" -ForegroundColor Yellow
  Write-Host "Ou crie um arquivo .env com TENANT_ID=uuid e rode: npm start" -ForegroundColor Yellow
  exit 1
}

node index.js
