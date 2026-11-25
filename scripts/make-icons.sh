#!/bin/sh
# Erzeugt die PNG-Icons aus scripts/icon.svg (benötigt ImageMagick)
set -e
cd "$(dirname "$0")/.."
for s in 192 512; do magick -background none -density 300 scripts/icon.svg -resize ${s}x${s} public/icon-$s.png; done
magick -background none -density 300 scripts/icon.svg -resize 180x180 public/apple-touch-icon.png
cp public/icon-512.png public/icon-maskable-512.png
magick -background none -density 300 scripts/icon.svg -resize 1024x1024 scripts/icon-1024.png
echo ok
