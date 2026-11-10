$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
foreach ($size in @(192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#143d37'))
    $scale = $size / 192.0
    $graphics.ScaleTransform($scale, $scale)
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#d4f487'), 6)
    $pen.StartCap = 'Round'
    $pen.EndCap = 'Round'
    $graphics.DrawArc($pen, 40, 36, 112, 112, 180, 180)
    $graphics.DrawBezier($pen, 40, 92, 52, 76, 63, 76, 75, 92)
    $graphics.DrawBezier($pen, 75, 92, 89, 76, 103, 76, 117, 92)
    $graphics.DrawBezier($pen, 117, 92, 129, 76, 140, 76, 152, 92)
    $graphics.DrawLine($pen, 40, 92, 96, 149)
    $graphics.DrawLine($pen, 152, 92, 96, 149)
    $graphics.DrawLine($pen, 75, 92, 96, 149)
    $graphics.DrawLine($pen, 117, 92, 96, 149)
    $bitmap.Save((Join-Path $projectRoot "public\icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
