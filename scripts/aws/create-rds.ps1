#Requires -Version 5.1
<#
.SYNOPSIS
  Create Cashmir Biotech RDS PostgreSQL in ap-south-1 using CloudFormation.

.EXAMPLE
  .\scripts\aws\create-rds.ps1 -MasterPassword "YourLongPassword123!"
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$MasterPassword,
  [string]$Region = "ap-south-1",
  [string]$StackName = "cashmir-biotech-rds",
  [string]$AwsCli = ""
)

$ErrorActionPreference = "Stop"

function Resolve-Aws {
  if ($AwsCli -and (Test-Path $AwsCli)) { return $AwsCli }
  $cmd = Get-Command aws -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\Amazon\AWSCLIV2\aws.exe",
    "${env:ProgramFiles(x86)}\Amazon\AWSCLIV2\aws.exe",
    "$env:LOCALAPPDATA\Programs\Amazon\AWSCLIV2\aws.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  throw "AWS CLI not found. Install Amazon.AWSCLI then re-open the terminal."
}

$aws = Resolve-Aws
Write-Host "Using AWS CLI: $aws"

& $aws sts get-caller-identity --region $Region | Out-Host
if ($LASTEXITCODE -ne 0) {
  throw @"
AWS credentials are not configured.

1) Create an IAM user Access Key in the AWS console (IAM → Users → Security credentials)
2) Run:  aws configure
   Region: ap-south-1
   Output: json
Then re-run this script.
"@
}

Write-Host "Discovering default VPC subnets in $Region..."
$subnetsJson = & $aws ec2 describe-subnets --region $Region --filters "Name=default-for-az,Values=true" --query "Subnets[].SubnetId" --output json
$subnets = ($subnetsJson | ConvertFrom-Json)
if (-not $subnets -or $subnets.Count -lt 2) {
  # fallback: any subnets in the default VPC
  $vpc = & $aws ec2 describe-vpcs --region $Region --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text
  $subnetsJson = & $aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$vpc" --query "Subnets[].SubnetId" --output json
  $subnets = ($subnetsJson | ConvertFrom-Json)
}
if ($subnets.Count -lt 2) {
  throw "Need at least 2 subnets in the default VPC. Found: $($subnets -join ', ')"
}
# pick two in different AZs if possible
$subnetList = ($subnets | Select-Object -First 2) -join ","

$template = Join-Path $PSScriptRoot "..\..\deploy\aws\cloudformation-rds.yml"
$template = (Resolve-Path $template).Path

Write-Host "Creating/updating stack $StackName with subnets $subnetList ..."
& $aws cloudformation deploy `
  --region $Region `
  --stack-name $StackName `
  --template-file $template `
  --parameter-overrides `
    "MasterUserPassword=$MasterPassword" `
    "SubnetIds=$subnetList" `
  --capabilities CAPABILITY_NAMED_IAM

if ($LASTEXITCODE -ne 0) { throw "CloudFormation deploy failed." }

Write-Host "Waiting for RDS to become available (can take 5–10 minutes)..."
$endpoint = & $aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='EndpointAddress'].OutputValue" --output text

$port = & $aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='EndpointPort'].OutputValue" --output text

$dbName = & $aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseName'].OutputValue" --output text

$user = & $aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='MasterUsername'].OutputValue" --output text

$encPass = [uri]::EscapeDataString($MasterPassword)
$databaseUrl = "postgresql://${user}:${encPass}@${endpoint}:${port}/${dbName}?schema=public&connection_limit=5&pool_timeout=10"

$outDir = Join-Path $PSScriptRoot "..\..\deploy\aws\out"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir "rds-connection.txt"
@"
# Generated $(Get-Date -Format o) — DO NOT COMMIT
Endpoint=$endpoint
Port=$port
Database=$dbName
Username=$user
DATABASE_URL=$databaseUrl
DIRECT_URL=$databaseUrl
"@ | Set-Content -Path $outFile -Encoding UTF8

Write-Host ""
Write-Host "RDS ready (or stack updated)."
Write-Host "Endpoint: $endpoint"
Write-Host "Saved connection string to: $outFile"
Write-Host ""
Write-Host "Next: run migrations:"
Write-Host "  .\scripts\aws\migrate-rds.ps1"
