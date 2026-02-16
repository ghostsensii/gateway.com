# Script PowerShell para gerar logo.png
Add-Type -AssemblyName System.Drawing

$width = 512
$height = 512

# Criar bitmap
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# Fundo preto
$graphics.Clear([System.Drawing.Color]::Black)

# Configurar texto branco
$font = New-Object System.Drawing.Font("Arial", 180, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center

# Desenhar OZN
$rect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
$graphics.DrawString("OZN", $font, $brush, $rect, $format)

# Salvar como PNG
$outputPath = Join-Path $PSScriptRoot "logo.png"
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Limpar recursos
$graphics.Dispose()
$bitmap.Dispose()
$font.Dispose()
$brush.Dispose()

Write-Host "✅ Logo PNG criado com sucesso em: $outputPath" -ForegroundColor Green
