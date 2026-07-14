#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy EventBridge Scheduler crons that hit Amplify cron API routes.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$SiteBaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$CronSecret,
  [string]$Region = "ap-south-1",
  [string]$StackName = "cashmir-biotech-crons"
)

$ErrorActionPreference = "Stop"

function Resolve-Aws {
  $cmd = Get-Command aws -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $c = "$env:ProgramFiles\Amazon\AWSCLIV2\aws.exe"
  if (Test-Path $c) { return $c }
  throw "AWS CLI missing — reopen terminal after install"
}

$aws = Resolve-Aws
$SiteBaseUrl = $SiteBaseUrl.TrimEnd("/")
$template = (Resolve-Path (Join-Path $PSScriptRoot "..\..\deploy\aws\cloudformation-crons.yml")).Path

& $aws sts get-caller-identity --region $Region | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Run aws configure first" }

& $aws cloudformation deploy `
  --region $Region `
  --stack-name $StackName `
  --template-file $template `
  --parameter-overrides `
    "SiteBaseUrl=$SiteBaseUrl" `
    "CronSecret=$CronSecret" `
  --capabilities CAPABILITY_NAMED_IAM

if ($LASTEXITCODE -ne 0) { throw "Cron stack deploy failed" }

Write-Host "Cron schedules deployed:"
Write-Host "  - rate(20 minutes) → $SiteBaseUrl/api/cron/release-stale-orders"
Write-Host "  - daily 21:30 UTC (03:00 IST) → $SiteBaseUrl/api/cron/cleanup-sessions"
