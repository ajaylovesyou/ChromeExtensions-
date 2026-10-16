Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)
$outDir = "E:\Goal\Extension\ScamShield AI - Your Online Safety Assistant\icons"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Clear transparent
    $g.Clear([System.Drawing.Color]::Transparent)

    # Scale calculations
    $pad = [float]($size * 0.08)
    $w = [float]($size - (2 * $pad))
    $h = [float]($size - (2 * $pad))

    # Shield path
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $top = $pad
    $left = $pad
    $right = $pad + $w
    $bottom = $pad + $h
    $midX = $pad + ($w / 2.0)
    $cornerCurve = $w * 0.15

    # Points for a crisp shield
    $p1 = New-Object System.Drawing.PointF($left, ($top + $cornerCurve))
    $p2 = New-Object System.Drawing.PointF(($left + $cornerCurve), $top)
    $p3 = New-Object System.Drawing.PointF(($right - $cornerCurve), $top)
    $p4 = New-Object System.Drawing.PointF($right, ($top + $cornerCurve))
    $p5 = New-Object System.Drawing.PointF($right, ($top + ($h * 0.55)))
    $p6 = New-Object System.Drawing.PointF($midX, $bottom)
    $p7 = New-Object System.Drawing.PointF($left, ($top + ($h * 0.55)))

    $path.AddLine($p2, $p3)
    $path.AddBezier($p3, (New-Object System.Drawing.PointF($right, $top)), $p4, $p4)
    $path.AddLine($p4, $p5)
    $path.AddBezier($p5, (New-Object System.Drawing.PointF($right, ($bottom - ($h * 0.15)))), (New-Object System.Drawing.PointF(($midX + ($w * 0.2)), $bottom)), $p6)
    $path.AddBezier($p6, (New-Object System.Drawing.PointF(($midX - ($w * 0.2)), $bottom)), (New-Object System.Drawing.PointF($left, ($bottom - ($h * 0.15)))), $p7)
    $path.AddLine($p7, $p1)
    $path.AddBezier($p1, (New-Object System.Drawing.PointF($left, $top)), $p2, $p2)
    $path.CloseFigure()

    # Gradient fill for shield (Cyber Blue / Emerald Gradient)
    $rect = New-Object System.Drawing.RectangleF($pad, $pad, $w, $h)
    $c1 = [System.Drawing.Color]::FromArgb(255, 14, 165, 233)   # Sky 500
    $c2 = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)    # Slate 900
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)
    $g.FillPath($brush, $path)

    # Shield border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 56, 189, 248), [Math]::Max(1.0, [float]($size * 0.05)))
    $g.DrawPath($pen, $path)

    # Draw checkmark / security check inside
    $penCheck = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 52, 211, 153), [Math]::Max(1.5, [float]($size * 0.10)))
    $penCheck.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penCheck.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $chk1 = New-Object System.Drawing.PointF(($midX - ($w * 0.24)), ($top + ($h * 0.46)))
    $chk2 = New-Object System.Drawing.PointF(($midX - ($w * 0.06)), ($top + ($h * 0.62)))
    $chk3 = New-Object System.Drawing.PointF(($midX + ($w * 0.26)), ($top + ($h * 0.32)))

    $g.DrawLine($penCheck, $chk1, $chk2)
    $g.DrawLine($penCheck, $chk2, $chk3)

    $savePath = Join-Path $outDir "icon$size.png"
    $bmp.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Generated: $savePath"
}
