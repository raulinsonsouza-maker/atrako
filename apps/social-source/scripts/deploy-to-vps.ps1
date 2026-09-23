# Deploy para VPS Symbius (5.75.172.83) via SSH key + git pull + docker stack.
# Uso:
#   npm run deploy:vps
#   npm run deploy:vps -- -SkipBuild
#
# Config: deploy/vps.local.env (copie de deploy/vps.env.example)

param(
  [switch]$SkipBuild,
  [switch]$GitPull,
  [string]$VpsHost,
  [string]$VpsUser,
  [string]$VpsPath,
  [string]$SshKey,
  [string]$StackName = "symbius-central"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Load-EnvFile($path) {
  if (-not (Test-Path $path)) { return @{} }
  $vars = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    $vars[$k] = $v
  }
  return $vars
}

$cfg = Load-EnvFile (Join-Path $Root "deploy\vps.local.env")
if (-not $cfg.Count) {
  $cfg = Load-EnvFile (Join-Path $Root "deploy\vps.env.example")
}

if (-not $VpsHost) { $VpsHost = $cfg["VPS_HOST"] }
if (-not $VpsUser) { $VpsUser = $cfg["VPS_USER"] }
if (-not $VpsPath) { $VpsPath = $cfg["VPS_PATH"] }
if (-not $SshKey) {
  $SshKey = $cfg["SSH_KEY"]
  if ($SshKey) {
    $SshKey = [Environment]::ExpandEnvironmentVariables($SshKey)
  }
}
if ($cfg["STACK_NAME"]) { $StackName = $cfg["STACK_NAME"] }
if (-not $SshKey) { $SshKey = Join-Path $env:USERPROFILE ".ssh\id_ed25519" }

if (-not $VpsHost -or -not $VpsUser -or -not $VpsPath) {
  Write-Error "Configure deploy/vps.local.env (copie de deploy/vps.env.example)"
}

$Remote = "${VpsUser}@${VpsHost}"
$SshArgs = @("-i", $SshKey, "-o", "StrictHostKeyChecking=accept-new")

Write-Host "==> Deploy para ${Remote}:${VpsPath} (stack=$StackName)"

if ($GitPull -or -not $SkipBuild) {
  Write-Host "==> git pull + deploy-vps.sh na VPS"
  & ssh @SshArgs $Remote "cd '$VpsPath' && git fetch origin && git reset --hard origin/main && chmod +x scripts/deploy-vps.sh && STACK_NAME='$StackName' ./scripts/deploy-vps.sh"
} else {
  Write-Host "==> Apenas restart do stack (SkipBuild)"
  & ssh @SshArgs $Remote "cd '$VpsPath' && set -a && source .env && set +a && docker stack deploy -c deploy/stack.yml '$StackName'"
}

Write-Host "==> Deploy concluido"
Write-Host "    Flow:    https://flow.symbius.com.br"
Write-Host "    Central: https://central.symbius.com.br"
