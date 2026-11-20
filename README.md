# OmniConvert - Universal All-in-One File Converter Studio

A high-performance, private, 100% client-side web application to convert files across multiple formats right in the browser. Zero server uploads, zero file size restrictions, zero latency.

---

## 🚀 Key Highlights & Capabilities

- **100% Client-Side Privacy**: Files never leave your computer. Processing happens locally using WebAssembly, HTML5 Canvas, Web Audio API, and modern Web Crypto.
- **Universal Auto-Detection**: Drop any file onto the dropzone, and OmniConvert automatically inspects the file type, categorizes it, and offers relevant target formats.
- **Batch Processing & ZIP Packaging**: Select dozens of images or files, convert them concurrently, and download all results packaged into a `.zip` archive.
- **Side-by-Side Live Preview**: Real-time before/after comparison, file size change, and compression percentage indicator.
- **Clipboard & Drag-and-Drop**: Supports native dragging from your desktop or pasting directly with `Ctrl+V`.

---

## 📁 Supported Conversion Formats

### 1. 🖼️ Images & Graphics
- **Input**: PNG, JPG/JPEG, WEBP, GIF, SVG, BMP, ICO, AVIF
- **Output**: WEBP, PNG, JPEG, BMP, ICO, SVG, PDF
- **Features**:
  - Quality compression slider (10% - 100%)
  - Custom width/height resizing with aspect ratio locking & presets (25%, 50%, 75%, 100%)
  - Transforms: 90° rotation, horizontal flip, vertical flip
  - Filters: Grayscale, Invert, Sepia

### 2. 📊 Documents & Structured Data
- **Conversions**:
  - `JSON` ⇄ `CSV`
  - `JSON` ⇄ `XML`
  - `JSON` ⇄ `YAML`
  - `CSV` / `JSON` → `Markdown Table`
  - `CSV` / `JSON` → `HTML Table`
  - `Markdown` ⇄ `HTML`
  - Any text / Markdown → `Styled PDF Document`
- **Features**:
  - Live two-pane editor with syntax view
  - Instant clipboard copy and file download
  - Delimiter and quote handling for CSV/TSV

### 3. 📑 PDF Studio
- **Images to PDF**: Combine multiple images into a clean multi-page PDF document.
- **Custom Page Layout**:
  - Page Formats: A4, US Letter, Fit to image size
  - Orientations: Auto (matches image aspect), Portrait, Landscape
  - Margins: 0mm (full bleed), 5mm, 10mm, 20mm
- **Text & Markdown to PDF**: Renders formatted reports with headers, timestamps, and page dividers.

### 4. 🎵 Audio & Video Extractor
- **Extract Audio from Video**: Drop `MP4`, `WebM`, `MOV`, or `MKV` videos to extract the soundtrack without uploading gigabytes to third-party cloud servers.
- **Audio Converter**: Convert between `MP3`, `WAV` (16-bit PCM lossless), and `WebM`.
- **Audio Processing**: Volume booster slider (20% - 250%) and live player.

### 5. 🛠️ Developer Encodings & Checksums
- **File to Base64**: Generate Data URIs, raw Base64, and HTML `<img>` tags.
- **Base64 to File**: Decode Base64 strings back to downloadable files.
- **Cryptographic Hashes**: Compute SHA-256, SHA-512, and SHA-1 checksums instantly via the native Web Crypto API.

---

## 🏃 Quick Start

### Method 1: Instant Local Server (Recommended)
Double-click `start.bat` or run in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
The server will start at `http://localhost:8080` and open your default browser.

### Method 2: Direct Browser File
Simply double-click `index.html` or open it with Google Chrome / Microsoft Edge.

---

## 🛠️ Project File Structure

```
universal-file-converter/
├── index.html                  # Single-page web application UI
├── css/
│   └── styles.css              # Custom styling, animations & scrollbars
├── js/
│   ├── app.js                  # Master application coordinator & event routing
│   └── converters/
│       ├── image-converter.js  # Canvas, BMP, ICO, and SVG encoders
│       ├── document-converter.js # JSON, CSV, XML, YAML & Markdown parsers
│       ├── pdf-converter.js    # Multi-page jsPDF builder
│       ├── audio-converter.js  # Web Audio API decoder & WAV/MP3 encoders
│       ├── encoding-converter.js # Base64 and Web Crypto hashing
│       └── batch-processor.js  # Multi-file batch queue & JSZip packager
├── server.ps1                  # Native PowerShell HTTP server
├── start.bat                   # 1-click Windows launcher
└── README.md                   # Documentation
```
