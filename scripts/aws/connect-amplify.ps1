#Requires -Version 5.1
<#
.SYNOPSIS
  Print Amplify console steps + optional deep links. Creates app skeleton if access token provided.

Amplify←GitHub OAuth is easiest in the browser. This script documents exact clicks and
optionally verifies AWS identity + region.
#>
param(
  [string]$Region = "ap-south-1",
  [string]$AppName = "cashmir-biotech",
  [string]$Repo = "https://github.com/cashmirbiotechrepo-hash/Cashmir-Biotech",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

function Resolve-Aws {
  $cmd = Get-Command aws -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $c = "$env:ProgramFiles\Amazon\AWSCLIV2\aws.exe"
  if (Test-Path $c) { return $c }
  throw "AWS CLI missing"
}

$aws = Resolve-Aws
Write-Host "=== Amplify connect checklist ==="
Write-Host "Region must be: $Region (Mumbai)"
Write-Host ""

try {
  & $aws sts get-caller-identity --region $Region | Out-Host
} catch {
  Write-Warning "Not logged in. Run: aws configure   (region ap-south-1)"
}

Write-Host @"

BROWSER STEPS (do these in AWS Console — GitHub OAuth cannot be automated safely):

1. Open: https://$Region.console.aws.amazon.com/amplify/home?region=$Region
2. Click "Create new app" → "Host web app"
3. Choose GitHub → Authorize cashmirbiotechrepo-hash
4. Repository: Cashmir-Biotech
5. Branch: $Branch
6. App name: $AppName
7. Confirm amplify.yml is detected from repo root
8. BEFORE final save: Environment variables → import from deploy/aws/out/amplify-env.generated.txt
   + DATABASE_URL from deploy/aws/out/rds-connection.txt
9. Save and deploy

After deploy succeeds, copy the Amplify URL and set:
  NEXT_PUBLIC_SITE_URL=https://...

Then re-deploy (or update env and restart).

Repo expected: $Repo
"@
