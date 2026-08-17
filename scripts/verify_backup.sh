#!/usr/bin/env bash
set -euo pipefail

[ "$#" -ge 1 ] || { echo "Usage: $0 DATABASE.dump [MEDIA.tar.gz]" >&2; exit 1; }
verify_checksum() {
  local artifact="$1"
  [ -f "$artifact" ] || { echo "[verify] ERROR: Missing $artifact" >&2; exit 1; }
  [ -f "$artifact.sha256" ] || { echo "[verify] ERROR: Missing $artifact.sha256" >&2; exit 1; }
  if command -v sha256sum >/dev/null; then
    (cd "$(dirname "$artifact")" && sha256sum -c "$(basename "$artifact").sha256")
  else
    (cd "$(dirname "$artifact")" && shasum -a 256 -c "$(basename "$artifact").sha256")
  fi
}

verify_checksum "$1"
pg_restore --list "$1" >/dev/null
echo "[verify] Database archive catalog is readable."
if [ "$#" -ge 2 ]; then
  verify_checksum "$2"
  tar -tzf "$2" >/dev/null
  echo "[verify] Media archive catalog is readable."
fi
