#!/usr/bin/env bash
# Render the RTP briefs to PDF with headless Chromium.
# Usage: ./build-pdfs.sh [chromium-binary]
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${1:-${CHROME_BIN:-$(command -v chromium || command -v google-chrome || echo /opt/pw-browsers/chromium)}}"

for name in we-can-build-what-we-need relational-builder; do
  "$CHROME" --headless=new --disable-gpu --no-sandbox \
    --no-pdf-header-footer --print-to-pdf="$name.pdf" \
    "file://$PWD/$name.html" 2>/dev/null
  echo "built $name.pdf"
done
