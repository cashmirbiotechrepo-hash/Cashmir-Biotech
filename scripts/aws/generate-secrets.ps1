#Requires -Version 5.1
<#
.SYNOPSIS
  Generate production secrets for Amplify + write a local (gitignored) env file template.

.EXAMPLE
  .\scripts\aws\generate-secrets.ps1
#>
$ErrorActionPreference = "Stop"

function New-Secret([int]$Length = 48) {
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return (-join ($bytes | ForEach-Object { $_.ToString("x2") })).Substring(0, [Math]::Min($Length, 64))
}

function New-Exact32 {
  return (New-Secret 32).Substring(0, 32)
}

$outDir = Join-Path $PSScriptRoot "..\..\deploy\aws\out"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir "amplify-env.generated.txt"

$jwt = New-Secret 48
$pepper = New-Secret 48
$enc = New-Exact32
$cron = New-Secret 32
$pow = New-Secret 32

$content = @"
# Paste these into AWS Amplify → App settings → Environment variables
# NEVER commit this file. Generated: $(Get-Date -Format o)

JWT_SECRET=$jwt
PASSWORD_PEPPER=$pepper
ENCRYPTION_KEY=$enc
CRON_SECRET=$cron
POW_SECRET=$pow
RUNTIME_ENV_STRICT=true
ALLOW_UNPOOLED_DATABASE_URL=false

# Fill after RDS is ready (include pooling params for Amplify SSR):
# DATABASE_URL=postgresql://cashmir:PASSWORD@ENDPOINT:5432/cashmir?schema=public&connection_limit=5&pool_timeout=10
# DIRECT_URL=<same as DATABASE_URL if you use it elsewhere>

# Fill after first Amplify deploy URL is known:
# NEXT_PUBLIC_SITE_URL=https://main.xxxxx.amplifyapp.com

# From Upstash console:
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=

# From Razorpay dashboard (live or test):
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# RAZORPAY_WEBHOOK_SECRET=

# SMTP (Gmail app password etc.):
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=
"@

Set-Content -Path $outFile -Value $content -Encoding UTF8
Write-Host "Wrote $outFile"
Write-Host "Open that file and paste values into Amplify Environment variables."
Write-Host "ENCRYPTION_KEY length check: $($enc.Length) (must be 32)"
