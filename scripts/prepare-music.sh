#!/bin/sh
# Bereitet ein Suno-Stück fürs Spiel vor: höchstens 3 Minuten (Fanfare 12 s), weich ausblenden,
# Lautstärke angleichen (−16 LUFS), MP3 128 kbit/s nach public/audio/music/<name>.mp3
# Aufruf: sh scripts/prepare-music.sh <eingabe.mp3> <musik-name>
set -e
IN="$1"; NAME="$2"
MAX=180; FADE=4
[ "$NAME" = "musik-fanfare" ] && MAX=12 && FADE=2
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN" | cut -d. -f1)
[ "$DUR" -lt "$MAX" ] && MAX=$DUR
START=$((MAX - FADE))
mkdir -p "$(dirname "$0")/../public/audio/music"
ffmpeg -loglevel error -y -i "$IN" -t "$MAX" -af "afade=t=in:d=0.5,afade=t=out:st=$START:d=$FADE,loudnorm=I=-16:TP=-1.5:LRA=11" \
  -ar 44100 -ac 2 -codec:a libmp3lame -b:a 128k "$(dirname "$0")/../public/audio/music/$NAME.mp3"
echo "ok $NAME ($MAX s)"
