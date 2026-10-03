#!/usr/bin/env bash
# Готує hero-відео з вихідного кліпу (портрет 512×910, ~10 с):
#   storm  0.0–3.1 с  — гроза з блискавками (стан «Задовбало?»)
#   calm   3.4–5.4 с  — хмари розходяться, без блискавок (стан «Видихни.»)
# Кожен фрагмент — бумеранг (вперед + назад), щоб петля не мала стику.
# Вихід: public/media/hero/{storm,calm}-{portrait,landscape}.{webm,mp4} + постери.
set -euo pipefail
SRC="${1:?Usage: npm run media:hero -- <source-video>}"
OUT="$(dirname "$0")/../public/media/hero"
mkdir -p "$OUT"

# Вихідник має розмиті смуги-заповнювачі зверху й знизу; реальна картинка — 512×720 від y=94.
BASE="crop=512:720:0:94"
PORTRAIT="scale=540:760:flags=lanczos,unsharp=5:5:0.4"
landscape() { echo "crop=512:288:0:$1,scale=1280:720:flags=lanczos,unsharp=5:5:0.5"; }

encode() { # name start duration slow cropY
  local name=$1 ss=$2 dur=$3 slow=$4 ly=$5
  local pre="trim=start=$ss:duration=$dur,setpts=PTS-STARTPTS,$BASE"
  [ "$slow" != "1" ] && pre="$pre,setpts=$slow*PTS,minterpolate=fps=30:mi_mode=blend"
  for variant in portrait landscape; do
    local vf
    if [ $variant = portrait ]; then vf="$pre,$PORTRAIT"; else vf="$pre,$(landscape "$ly")"; fi
    local graph="[0:v]$vf,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]"
    ffmpeg -v error -y -i "$SRC" -filter_complex "$graph" -map "[v]" -an \
      -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 2 "$OUT/$name-$variant.webm"
    ffmpeg -v error -y -i "$SRC" -filter_complex "$graph" -map "[v]" -an \
      -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart "$OUT/$name-$variant.mp4"
  done
}

poster() { # name time cropY
  local name=$1 t=$2 ly=$3
  ffmpeg -v error -y -ss "$t" -i "$SRC" -frames:v 1 -vf "$BASE,$PORTRAIT" -c:v libwebp -quality 72 "$OUT/$name-portrait.webp"
  ffmpeg -v error -y -ss "$t" -i "$SRC" -frames:v 1 -vf "$BASE,$(landscape "$ly")" -c:v libwebp -quality 72 "$OUT/$name-landscape.webp"
}

encode storm 0.0 3.1 1 300
encode calm 3.4 2.0 2.2 120
# Постер грози — кадр без спалаху блискавки (для reduced-motion і поки відео вантажиться).
poster storm 2.45 300
poster calm 4.4 120
# OG-зображення 1200×630.
ffmpeg -v error -y -ss 4.4 -i "$SRC" -frames:v 1 -vf "$BASE,crop=512:269:0:150,scale=1200:630:flags=lanczos" -q:v 4 "$OUT/../../og.jpg"
ls -la "$OUT" "$OUT/../../og.jpg"
