#!/usr/bin/env bash
# Runs on the production host via SSH. It preserves untracked environment files
# across the release checkout and delegates all guarded work to the release.
set -euo pipefail

release_sha="${1:-}"
app_root="${TCH_APP_ROOT:-/opt/tch/app}"
release_state="${TCH_RELEASE_STATE:-/var/lib/tch/releases}"
[ "$release_sha" != "" ] || { echo "[release] Missing release SHA." >&2; exit 1; }
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "[release] Invalid release SHA." >&2; exit 1; }
[ -d "$app_root/.git" ] || { echo "[release] Repository not found at $app_root." >&2; exit 1; }
[ -f "$app_root/.env" ] || { echo "[release] Production .env is missing." >&2; exit 1; }

cd "$app_root"
previous_sha="$(git rev-parse HEAD)"
env_hold="$(mktemp -d)"
trap 'rm -rf "$env_hold"' EXIT
cp .env "$env_hold/root.env"
if [ -f frontend/.env.local ]; then cp frontend/.env.local "$env_hold/frontend.env.local"; fi

git fetch --quiet origin main
git cat-file -e "$release_sha^{commit}"
git merge-base --is-ancestor "$release_sha" origin/main || {
  echo "[release] Refused: requested SHA is not contained in origin/main." >&2
  exit 1
}
git checkout --detach "$release_sha"
cp "$env_hold/root.env" .env
if [ -f "$env_hold/frontend.env.local" ]; then cp "$env_hold/frontend.env.local" frontend/.env.local; fi
chmod 600 .env frontend/.env.local 2>/dev/null || true

install -d -m 700 "$release_state"
printf '%s\n' "$previous_sha" > "$release_state/previous-sha"
printf '%s\n' "$release_sha" > "$release_state/candidate-sha"
chmod 600 "$release_state/previous-sha" "$release_state/candidate-sha"

./scripts/deploy_production.sh "$release_sha" "$previous_sha"
printf '%s\n' "$release_sha" > "$release_state/current-sha"
chmod 600 "$release_state/current-sha"
echo "[release] Production release completed: $release_sha"

