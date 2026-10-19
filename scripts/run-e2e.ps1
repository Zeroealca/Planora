param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('safe', 'local')]
  [string]$Suite,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArgs
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$vitePattern = [regex]::Escape($workspace) + '.*vite.*--host 127\.0\.0\.1.*--port 4173'

function Get-PlanoraVite {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match $vitePattern }
}

function Stop-PlanoraVite {
  Get-PlanoraVite | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

if (Get-PlanoraVite) {
  throw 'Vite de Planora ya está escuchando. Ciérralo antes de iniciar una ejecución E2E para evitar reutilizar un entorno incorrecto.'
}

try {
  $cli = Join-Path $workspace 'node_modules\@playwright\test\cli.js'
  $arguments = @($cli, 'test')
  if ($Suite -eq 'safe') {
    $arguments += '--project=safe-smoke'
  } else {
    $arguments = @('--env-file=.env.e2e.local') + $arguments + '--project=local-chromium'
  }
  $arguments += $PlaywrightArgs

  & node @arguments
  $exitCode = $LASTEXITCODE
  Write-Host "Playwright exit code: $exitCode"
  if ($exitCode -ne 0) { exit $exitCode }
} finally {
  Stop-PlanoraVite
}
