#!/bin/sh
# Run after activating Emscripten 3.1.74. Uses only MIT source and CC0 data.
set -eu
cadet_tools=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -ne 3 ]; then
  echo 'Usage: build.sh FRESH_ENGINE_CHECKOUT OPEN_CADET_DATA OUTPUT_DIRECTORY' >&2
  exit 2
fi
cadet_engine=$(CDPATH= cd -- "$1" && pwd)
cadet_data=$(CDPATH= cd -- "$2" && pwd)
cadet_output=$3
command -v emcmake >/dev/null
command -v cmake >/dev/null
git -C "$cadet_engine" apply --check "$cadet_tools/source.patch"
git -C "$cadet_engine" apply "$cadet_tools/source.patch"
mkdir -p "$cadet_engine/game_resources" "$cadet_output"
cp "$cadet_data/PINBALL.DAT" "$cadet_engine/game_resources/PINBALL.DAT"
cp "$cadet_data"/sound*.wav "$cadet_engine/game_resources/"
if [ -f "$cadet_tools/table.rgba" ]; then cp "$cadet_tools/table.rgba" "$cadet_engine/game_resources/table.rgba"; fi
emcmake cmake -S "$cadet_engine" -B "$cadet_engine/build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DMUSIC_TSF=OFF
cmake --build "$cadet_engine/build" --parallel 6
cp "$cadet_engine/bin/space-cadet.js" "$cadet_engine/bin/space-cadet.wasm" "$cadet_engine/bin/space-cadet.data" "$cadet_output/"
