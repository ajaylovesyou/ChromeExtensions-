Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$outDir = "E:\Goal\Extension\Grammarly - AI Writing Assistant\icons"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Transparent background
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($size * 0.06)
    $w = [float]($size - (2 * $pad))
    $h = [float]($size - (2 * $pad))

    # Base circle with vibrant Grammarly-style Emerald Teal Gradient
    $circleRect = New-Object System.Drawing.RectangleF($pad, $pad, $w, $h)
    $cTop = [System.Drawing.Color]::FromArgb(255, 16, 185, 129)    # Emerald 500
    $cBottom = [System.Drawing.Color]::FromArgb(255, 5, 150, 105)  # Emerald 600
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($circleRect, $cTop, $cBottom, 45.0)
    $g.FillEllipse($gradBrush, $circleRect)

    # Subtle inner glow / border ring
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 110, 231, 183), [Math]::Max(1.0, [float]($size * 0.04)))
    $g.DrawEllipse($borderPen, $circleRect)

    # Draw iconic "G" shape with pen tip or checkmark arrow
    $centerX = [float]($size / 2.0)
    $centerY = [float]($size / 2.0)
    $radius = [float]($size * 0.28)
    $penWidth = [Math]::Max(2.0, [float]($size * 0.12))

    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $arcRect = New-Object System.Drawing.RectangleF(($centerX - $radius), ($centerY - $radius), ($radius * 2), ($radius * 2))
    # Draw arc from 40 degrees around 280 degrees (open G circle)
    $g.DrawArc($whitePen, $arcRect, 45, 275)

    # G horizontal bar inward
    $barY = $centerY + ($radius * 0.08)
    $barStartX = $centerX + ($radius * 0.95)
    $barEndX = $centerX + ($radius * 0.15)
    $g.DrawLine($whitePen, $barStartX, $barY, $barEndX, $barY)

    # Sparkle / Star for AI at top right if size >= 32
    if ($size -ge 32) {
        $spX = [float]($centerX + ($radius * 0.75))
        $spY = [float]($centerY - ($radius * 0.75))
        $spSize = [float]($size * 0.12)
        $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 253, 224, 71)) # Amber / yellow
        
        $spPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $spPath.AddPolygon(@(
            (New-Object System.Drawing.PointF($spX, ($spY - $spSize))),
            (New-Object System.Drawing.PointF(($spX + ($spSize * 0.3)), ($spY - ($spSize * 0.3)))),
            (New-Object System.Drawing.PointF(($spX + $spSize), $spY)),
            (New-Object System.Drawing.PointF(($spX + ($spSize * 0.3)), ($spY + ($spSize * 0.3)))),
            (New-Object System.Drawing.PointF($spX, ($spY + $spSize))),
            (New-Object System.Drawing.PointF(($spX - ($spSize * 0.3)), ($spY + ($spSize * 0.3)))),
            (New-Object System.Drawing.PointF(($spX - $spSize), $spY)),
            (New-Object System.Drawing.PointF(($spX - ($spSize * 0.3)), ($spY - ($spSize * 0.3))))
        ))
        $g.FillPath($goldBrush, $spPath)
        $spPath.Dispose()
        $goldBrush.Dispose()
    }

    $savePath = Join-Path $outDir "icon$size.png"
    $bmp.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)

    $whitePen.Dispose()
    $borderPen.Dispose()
    $gradBrush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Generated icon: $savePath"
}
