# Genera PNG de icono PWA y favicon desde el diseño (ejecutar tras cambiar icon.svg).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $root 'public'

function Draw-GameScoreIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $bgTop = [System.Drawing.Color]::FromArgb(19, 47, 76)
  $bgMid = [System.Drawing.Color]::FromArgb(10, 22, 40)
  $bgBot = [System.Drawing.Color]::FromArgb(6, 11, 18)
  $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($size, $size),
    $bgTop,
    $bgBot
  )
  $g.FillRectangle($brushBg, 0, 0, $size, $size)
  $brushBg.Dispose()

  $corner = [int]($size * 0.21)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $corner * 2, $corner * 2, 180, 90)
  $path.AddArc($size - $corner * 2, 0, $corner * 2, $corner * 2, 270, 90)
  $path.AddArc($size - $corner * 2, $size - $corner * 2, $corner * 2, $corner * 2, 0, 90)
  $path.AddArc(0, $size - $corner * 2, $corner * 2, $corner * 2, 90, 90)
  $path.CloseFigure()
  $g.SetClip($path)

  $pad = [int]($size * 0.14)
  $pw = $size - 2 * $pad
  $ph = [int]($size * 0.42)
  $py = [int]($size * 0.29)
  $panel = New-Object System.Drawing.Rectangle $pad, $py, $pw, $ph
  $brushPanel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 41, 59))
  $g.FillRectangle($brushPanel, $panel)
  $brushPanel.Dispose()
  $penGold = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(201, 162, 39)), ([float]($size * 0.018))
  $g.DrawRectangle($penGold, $panel.X, $panel.Y, $panel.Width - 1, $panel.Height - 1)

  $fontSize = [single]($size * 0.2)
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
  $brushWhite = [System.Drawing.Brushes]::White
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $scoreRect = New-Object System.Drawing.RectangleF ($pad), ($py + $ph * 0.08), ($pw), ($ph * 0.88)
  $g.DrawString('0 - 0', $font, $brushWhite, $scoreRect, $sf)

  $barY = $py + $ph + [int]($size * 0.04)
  $barW = [int]($size * 0.39)
  $barX = [int](($size - $barW) / 2)
  $barH = [int]([Math]::Max(3, $size * 0.012))
  $g.FillRectangle(
    (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(201, 162, 39))),
    $barX,
    $barY,
    $barW,
    $barH
  )

  $font.Dispose()
  $penGold.Dispose()
  $path.Dispose()
  $g.Dispose()
  return $bmp
}

$sizes = @{
  'favicon-16x16.png'   = 16
  'favicon-32x32.png'   = 32
  'apple-touch-icon.png' = 180
  'pwa-192x192.png'     = 192
  'pwa-512x512.png'     = 512
}

foreach ($name in $sizes.Keys) {
  $px = $sizes[$name]
  $bmp = Draw-GameScoreIcon $px
  $path = Join-Path $outDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "OK $name ($px px)"
}

Write-Host "Iconos PNG generados en public/"
