# OmniConvert - Lightweight Windows PowerShell HTTP Server
param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Port $Port is busy, trying port $($Port + 1)..." -ForegroundColor Yellow
    $Port = $Port + 1
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  OmniConvert - Universal File Converter Studio" -ForegroundColor Green
Write-Host "  Server running at: $prefix" -ForegroundColor White
Write-Host "  Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $NoBrowser) {
    Start-Process $prefix
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".wasm" = "application/wasm"
    ".wav"  = "audio/wav"
    ".mp3"  = "audio/mpeg"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") {
            $path = "/index.html"
        }

        $localPath = Join-Path $scriptDir $path.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)

        if (Test-Path $localPath -PathType Leaf) {
            $extension = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
            $response.ContentType = $contentType
            $response.AddHeader("Cache-Control", "no-cache")

            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errorMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($errorMsg, 0, $errorMsg.Length)
        }

        $response.Close()
    }
} finally {
    $listener.Stop()
}
