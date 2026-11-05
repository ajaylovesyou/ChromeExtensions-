Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$outDir = "E:\Goal\Extension\Bitwarden Password Manager - Store and autofill passwords and passkeys\icons"

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

    $pad = [float]($size * 0.06)
    $w = [float]($size - (2 * $pad))
    $h = [float]($size - (2 * $pad))
    $radius = [float]($size * 0.22)

    # Rounded rectangle path (Squircle badge)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rect = New-Object System.Drawing.RectangleF($pad, $pad, $w, $h)
    
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc(($rect.Right - $d), $rect.Y, $d, $d, 270, 90)
    $path.AddArc(($rect.Right - $d), ($rect.Bottom - $d), $d, $d, 0, 90)
    $path.AddArc($rect.X, ($rect.Bottom - $d), $d, $d, 90, 90)
    $path.CloseFigure()

    # Premium Bitwarden Brand Royal Blue Gradient
    $cTop = [System.Drawing.Color]::FromArgb(255, 23, 93, 220)     # #175DDC (Bitwarden Blue)
    $cBottom = [System.Drawing.Color]::FromArgb(255, 14, 43, 116)  # #0E2B74 (Deep Vault Navy)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 60.0)
    $g.FillPath($gradBrush, $path)

    # Subtle inner highlight stroke
    $strokePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), [float]($size * 0.02))
    $g.DrawPath($strokePen, $path)

    # Draw Shield Symbol in Center
    $cx = [float]($size / 2.0)
    $cy = [float]($size / 2.0)
    $sw = [float]($size * 0.52)
    $sh = [float]($size * 0.58)

    $shieldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $sx = $cx - ($sw / 2.0)
    $sy = $cy - ($sh / 2.0) + ($size * 0.02)

    # Shield vertices: top-left, top-right, right-curve, bottom-point, left-curve
    $pTopLeft = New-Object System.Drawing.PointF($sx, $sy)
    $pTopRight = New-Object System.Drawing.PointF(($sx + $sw), $sy)
    $pMidRight = New-Object System.Drawing.PointF(($sx + $sw), ($sy + $sh * 0.45))
    $pBottom = New-Object System.Drawing.PointF($cx, ($sy + $sh))
    $pMidLeft = New-Object System.Drawing.PointF($sx, ($sy + $sh * 0.45))

    $shieldPath.AddLine($pTopLeft, $pTopRight)
    $shieldPath.AddCurve(@($pTopRight, $pMidRight, $pBottom), 0.5)
    $shieldPath.AddCurve(@($pBottom, $pMidLeft, $pTopLeft), 0.5)
    $shieldPath.CloseFigure()

    # Draw Shield Outline in Pure White
    $shieldPenWidth = [Math]::Max(1.5, ($size * 0.075))
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]$shieldPenWidth)
    $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $whitePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($whitePen, $shieldPath)

    # Draw Inner Keyhole / Lock Core
    $innerSize = [float]($size * 0.16)
    $keyCircleX = $cx - ($innerSize / 2.0)
    $keyCircleY = $cy - ($innerSize * 0.6)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($whiteBrush, $keyCircleX, $keyCircleY, $innerSize, $innerSize)

    # Keyhole stem (triangle / trapezoid)
    $stemPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $stemTopY = $keyCircleY + ($innerSize * 0.55)
    $stemBottomY = $keyCircleY + ($innerSize * 1.55)
    $stemWidthTop = [float]($innerSize * 0.48)
    $stemWidthBottom = [float]($innerSize * 0.75)

    $stemP1 = New-Object System.Drawing.PointF(($cx - $stemWidthTop / 2.0), $stemTopY)
    $stemP2 = New-Object System.Drawing.PointF(($cx + $stemWidthTop / 2.0), $stemTopY)
    $stemP3 = New-Object System.Drawing.PointF(($cx + $stemWidthBottom / 2.0), $stemBottomY)
    $stemP4 = New-Object System.Drawing.PointF(($cx - $stemWidthBottom / 2.0), $stemBottomY)

    $stemPath.AddPolygon(@($stemP1, $stemP2, $stemP3, $stemP4))
    $g.FillPath($whiteBrush, $stemPath)

    # Save PNG
    $dest = Join-Path $outDir "icon$size.png"
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)

    # Clean up
    $whiteBrush.Dispose()
    $whitePen.Dispose()
    $shieldPenWidth
    $strokePen.Dispose()
    $gradBrush.Dispose()
    $path.Dispose()
    $shieldPath.Dispose()
    $stemPath.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    Write-Host "Generated: $dest"
}
