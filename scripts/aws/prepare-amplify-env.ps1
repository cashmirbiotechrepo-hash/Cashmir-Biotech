#Requires -Version 5.1
<#
.SYNOPSIS
  Merge generated secrets + RDS URL into one Amplify env paste file + checklist.
#>
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$out = Join-Path $root "deploy\aws\out"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$secrets = Join-Path $out "amplify-env.generated.txt"
$rds = Join-Path $out "rds-connection.txt"
$merged = Join-Path $out "amplify-env.FINAL.txt"

if (-not (Test-Path $secrets)) {
  Write-Host "Generating secrets..."
  & (Join-Path $PSScriptRoot "generate-secrets.ps1")
}

$lines = Get-Content $secrets
$dbUrl = $null
if (Test-Path $rds) {
  Get-Content $rds | ForEach-Object {
    if ($_ -match '^DATABASE_URL=(.+)$') { $dbUrl = $Matches[1].Trim() }
  }
}

$extra = @()
if ($dbUrl) {
  $extra += "DATABASE_URL=$dbUrl"
  $extra += "DIRECT_URL=$dbUrl"
} else {
  $extra += "# DATABASE_URL=  ← run create-rds.ps1 then re-run this script"
  $extra += "# DIRECT_URL="
}

$extra += "# NEXT_PUBLIC_SITE_URL=https://YOUR_AMPLIFY_URL"
$extra += "# UPSTASH_REDIS_REST_URL="
$extra += "# UPSTASH_REDIS_REST_TOKEN="
$extra += "# RAZORPAY_KEY_ID="
$extra += "# RAZORPAY_KEY_SECRET="
$extra += "# RAZORPAY_WEBHOOK_SECRET="
$extra += "# SMTP_HOST=smtp.gmail.com"
$extra += "# SMTP_PORT=587"
$extra += "# SMTP_USER="
$extra += "# SMTP_PASS="
$extra += "# SMTP_FROM="

($lines + "" + $extra) | Set-Content -Path $merged -Encoding UTF8
Write-Host "Wrote $merged"
Write-Host ""
Write-Host "Amplify console → App → Hosting → Environment variables → Add variables"
Write-Host "Paste every KEY=VALUE line (skip comments)."
Write-Host ""
Write-Host "Still fill by hand: NEXT_PUBLIC_SITE_URL, Upstash, Razorpay, SMTP"
