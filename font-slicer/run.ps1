param([Parameter(ValueFromRemainingArguments=$true)][string[]]$ToolArguments)
$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8='1'
$env:PYTHONIOENCODING='utf-8'
$python = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
$requirements = Join-Path $PSScriptRoot 'requirements.txt'
if (!(Test-Path -LiteralPath $python)) {
    & py -3.12 -m venv (Join-Path $PSScriptRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw '无法建立 Python 3.12 环境，请安装 Python 3.12。' }
}
$expected = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash
$stamp = Join-Path $PSScriptRoot '.venv/requirements.sha256'
$installed = if (Test-Path -LiteralPath $stamp) { (Get-Content -LiteralPath $stamp -Raw).Trim() } else { '' }
if ($installed -ne $expected) {
    & $python -m pip install --disable-pip-version-check --no-input --requirement $requirements
    if ($LASTEXITCODE -ne 0) { throw '安装字体工具依赖失败。' }
    [IO.File]::WriteAllText($stamp, $expected)
}
if (!$ToolArguments -or $ToolArguments.Count -eq 0) { $ToolArguments = @('update') }
& $python (Join-Path $PSScriptRoot 'program/font_slicer.py') @ToolArguments
exit $LASTEXITCODE
