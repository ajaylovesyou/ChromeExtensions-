Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$outDir = "E:\Goal\Extension\KeepSync - Notes, Snippets & Web Clipper for Google Keep\icons"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Transparent background
    $g.Clear([System.Drawing.Color]::Transparent)

    $pad = [float]($size * 0.05)
    $w = [float]($size - (2 * $pad))
    $h = [float]($size - (2 * $pad))
    $radius = [float]($size * 0.22)

    # Rounded rectangle path (Squircle)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rect = New-Object System.Drawing.RectangleF($pad, $pad, $w, $h)
    
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc(($rect.Right - $d), $rect.Y, $d, $d, 270, 90)
    $path.AddArc(($rect.Right - $d), ($rect.Bottom - $d), $d, $d, 0, 90)
    $path.AddArc($rect.X, ($rect.Bottom - $d), $d, $d, 90, 90)
    $path.CloseFigure()

    # Vibrant Google Keep Amber Gradient
    $cTop = [System.Drawing.Color]::FromArgb(255, 251, 191, 36)    # Amber 400
    $cBottom = [System.Drawing.Color]::FromArgb(255, 217, 119, 6)   # Amber 600
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 60.0)
    $g.FillPath($gradBrush, $path)

    # Subtle inner border ring
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 254, 243, 199), [Math]::Max(1.0, [float]($size * 0.035)))
    $g.DrawPath($borderPen, $path)

    # Center coords
    $cx = [float]($size / 2.0)
    $cy = [float]($size * 0.44)

    # Draw iconic Google Keep bulb shape
    $bulbRadius = [float]($size * 0.24)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, [float]($size * 0.09)))
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Bulb head circle / dome
    $bulbRect = New-Object System.Drawing.RectangleF(($cx - $bulbRadius), ($cy - $bulbRadius), ($bulbRadius * 2), ($bulbRadius * 2))
    $g.FillEllipse($whiteBrush, $bulbRect)

    # Bulb waist taper to socket
    $waistTop = $cy + ($bulbRadius * 0.3)
    $waistBottom = $cy + ($bulbRadius * 1.05)
    $waistHalfWidth = $bulbRadius * 0.58

    $waistPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $waistPath.AddPolygon(@(
        (New-Object System.Drawing.PointF(($cx - $bulbRadius * 0.85), $waistTop)),
        (New-Object System.Drawing.PointF(($cx + $bulbRadius * 0.85), $waistTop)),
        (New-Object System.Drawing.PointF(($cx + $waistHalfWidth), $waistBottom)),
        (New-Object System.Drawing.PointF(($cx - $waistHalfWidth), $waistBottom))
    ))
    $g.FillPath($whiteBrush, $waistPath)
    $waistPath.Dispose()

    # Screw base lines
    $baseY1 = $waistBottom + ($size * 0.03)
    $baseY2 = $baseY1 + ($size * 0.055)
    $baseY3 = $baseY2 + ($size * 0.055)

    $basePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 254, 243, 199), [Math]::Max(1.0, [float]($size * 0.05)))
    $basePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $basePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $bWidth1 = $waistHalfWidth * 0.95
    $bWidth2 = $waistHalfWidth * 0.75
    $bWidth3 = $waistHalfWidth * 0.5

    $g.DrawLine($basePen, ($cx - $bWidth1), $baseY1, ($cx + $bWidth1), $baseY1)
    $g.DrawLine($basePen, ($cx - $bWidth2), $baseY2, ($cx + $bWidth2), $baseY2)
    if ($size -ge 32) {
        $g.DrawLine($basePen, ($cx - $bWidth3), $baseY3, ($cx + $bWidth3), $baseY3)
    }

    # Inner filament glow (amber inverted)
    if ($size -ge 32) {
        $filPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 217, 119, 6), [Math]::Max(1.0, [float]($size * 0.045)))
        $filPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $filPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $filPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $filPath.AddArc(($cx - $bulbRadius * 0.45), ($cy - $bulbRadius * 0.5), ($bulbRadius * 0.9), ($bulbRadius * 0.9), 200, 140)
        $g.DrawPath($filPen, $filPath)
        $filPath.Dispose()
        $filPen.Dispose()
    }

    # Sync badge overlay at bottom-right for size >= 32
    if ($size -ge 32) {
        $badgeRadius = [float]($size * 0.23)
        $badgeX = [float]($size - $pad - $badgeRadius)
        $badgeY = [float]($size - $pad - $badgeRadius)

        # Badge circle with dark charcoal background for pop
        $badgeRect = New-Object System.Drawing.RectangleF(($badgeX - $badgeRadius), ($badgeY - $badgeRadius), ($badgeRadius * 2), ($badgeRadius * 2))
        $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 32, 33, 36))
        $g.FillEllipse($badgeBrush, $badgeRect)

        $badgeBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.0, [float]($size * 0.03)))
        $g.DrawEllipse($badgeBorderPen, $badgeRect)

        # Dual revolving arrows (Sync symbol) in bright teal/emerald
        $syncPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 52, 211, 153), [Math]::Max(1.2, [float]($size * 0.055)))
        $syncPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $syncPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

        $syncArcR = $badgeRadius * 0.6
        $syncArcRect = New-Object System.Drawing.RectangleF(($badgeX - $syncArcR), ($badgeY - $syncArcR), ($syncArcR * 2), ($syncArcR * 2))
        $g.DrawArc($syncPen, $syncArcRect, 25, 140)
        $g.DrawArc($syncPen, $syncArcRect, 205, 140)

        # Arrowheads
        $arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 52, 211, 153))
        $arrowSize = [float]($size * 0.045)
        
        # Arrowhead 1
        $g.FillPolygon($arrowBrush, @(
            (New-Object System.Drawing.PointF(($badgeX + $syncArcR * 0.8), ($badgeY + $syncArcR * 0.6))),
            (New-Object System.Drawing.PointF(($badgeX + $syncArcR * 1.1), ($badgeY + $syncArcR * 0.2))),
            (New-Object System.Drawing.PointF(($badgeX + $syncArcR * 0.4), ($badgeY + $syncArcR * 0.2)))
        ))
        
        # Arrowhead 2
        $g.FillPolygon($arrowBrush, @(
            (New-Object System.Drawing.PointF(($badgeX - $syncArcR * 0.8), ($badgeY - $syncArcR * 0.6))),
            (New-Object System.Drawing.PointF(($badgeX - $syncArcR * 1.1), ($badgeY - $syncArcR * 0.2))),
            (New-Object System.Drawing.PointF(($badgeX - $syncArcR * 0.4), ($badgeY - $syncArcR * 0.2)))
        ))

        $arrowBrush.Dispose()
        $syncPen.Dispose()
        $badgeBorderPen.Dispose()
        $badgeBrush.Dispose()
    }

    $savePath = Join-Path $outDir "icon$size.png"
    $bmp.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)

    $basePen.Dispose()
    $whitePen.Dispose()
    $whiteBrush.Dispose()
    $borderPen.Dispose()
    $gradBrush.Dispose()
    $path.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Generated icon: $savePath"
}
