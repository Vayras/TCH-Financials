#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA_ROOT="${MEDIA_ROOT:-$REPO_ROOT/backend/media}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
[ -d "$MEDIA_ROOT" ] || { echo "[media-backup] ERROR: MEDIA_ROOT is not a directory: $MEDIA_ROOT" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
outfile="$BACKUP_DIR/tch_media_${timestamp}.tar.gz"
tmpfile="$(mktemp "$BACKUP_DIR/.tch_media_${timestamp}.XXXXXX")"
trap 'rm -f "$tmpfile"' EXIT
tar -C "$MEDIA_ROOT" -czf "$tmpfile" .
tar -tzf "$tmpfile" >/dev/null
mv "$tmpfile" "$outfile"
trap - EXIT
if command -v sha256sum >/dev/null; then
  (cd "$BACKUP_DIR" && sha256sum "$(basename "$outfile")" > "$(basename "$outfile").sha256")
else
  (cd "$BACKUP_DIR" && shasum -a 256 "$(basename "$outfile")" > "$(basename "$outfile").sha256")
fi
chmod 600 "$outfile" "$outfile.sha256"
echo "[media-backup] Verified: $outfile"
echo "[media-backup] Checksum: $outfile.sha256"
