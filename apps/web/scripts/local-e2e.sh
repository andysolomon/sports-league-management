#!/usr/bin/env bash
#
# Bulletproof local e2e harness (WSM-000235).
#
# One command to bring up a clean, drift-proof local stack and run Playwright
# specs against it. Idempotent and port-safe: safe to re-run, and it never
# leaves (or fights) stray dev servers.
#
# Usage (from anywhere):
#   apps/web/scripts/local-e2e.sh                         # full suite
#   apps/web/scripts/local-e2e.sh gamecast.spec.ts        # one spec
#   apps/web/scripts/local-e2e.sh -g "offseason draft"    # by title
#   HEADED=1 apps/web/scripts/local-e2e.sh gamecast.spec.ts
#
# The recommended setup is a STABLE deploy key against your cloud dev
# deployment (same as CI) — its key never rotates, so local e2e is drift-proof.
# A local anonymous backend also works, but its admin key ROTATES on every
# re-provision (`convex dev` restart, `rm -rf .convex`), and a *stale* key in
# .env.local is the #1 cause of "BadAdminKey on every page". This script does a
# fail-fast admin preflight so a mismatched key surfaces as ONE clear error
# instead of a wall of confusing seed failures (WSM-000235).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

# --- 1. Read the few vars we need from .env.local ----------------------------
# NOTE: .env.local is a dotenv file, NOT a shell script — do not `source` it
# (values with spaces/`:`/`#` break bash). Read individual keys instead.
if [[ ! -f .env.local ]]; then
  red "✖ apps/web/.env.local not found. Copy .env.local.example and fill it in."
  exit 1
fi
# Value of a non-secret key (first match, everything after the first '=').
env_val() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'; }
# Presence only — used for CONVEX_ADMIN_KEY so the secret value is never read.
env_has() { grep -qE "^$1=.+" .env.local; }

CONVEX_URL="$(env_val NEXT_PUBLIC_CONVEX_URL)"
IS_LOCAL=0
case "$CONVEX_URL" in
  *127.0.0.1*|*localhost*) IS_LOCAL=1 ;;
esac

# --- 2. Preflight: fail fast with clear remediation --------------------------
if [[ -z "$CONVEX_URL" ]]; then
  red "✖ NEXT_PUBLIC_CONVEX_URL is unset in .env.local."
  exit 1
fi
if [[ "$IS_LOCAL" -eq 1 ]]; then
  green "✓ target: local backend ($CONVEX_URL)"
else
  yellow "✓ target: cloud dev deployment ($CONVEX_URL) — recommended, stable key"
fi
# Server-side reads AND internal-mutation seeds need an admin key that MATCHES
# the backend (presence check only — the value is never read here).
if ! env_has CONVEX_ADMIN_KEY; then
  red "✖ CONVEX_ADMIN_KEY is unset. Server components and the seed call"
  red "  admin-keyed internal functions, so it is required even for a local"
  red "  backend. Set it to your local backend's current key, or (recommended)"
  red "  a stable cloud-dev deploy key. See docs/development/LOCAL_TESTING.md."
  exit 1
fi
for v in E2E_CLERK_USER_ID E2E_CLERK_ORG_ID; do
  if ! env_has "$v"; then
    red "✖ $v is unset — the auth setup needs it. See .env.local.example."
    exit 1
  fi
done

# --- 3. Ensure the Convex backend is up (local only; cloud dev is always up) -
if [[ "$IS_LOCAL" -eq 1 ]]; then
  CONVEX_PORT="$(printf '%s' "$CONVEX_URL" | sed -E 's|.*:([0-9]+).*|\1|')"
  CONVEX_PORT="${CONVEX_PORT:-3210}"
  backend_up() { curl -fsS -o /dev/null "http://127.0.0.1:${CONVEX_PORT}/version" 2>/dev/null; }

  if backend_up; then
    green "✓ Convex local backend already up on :${CONVEX_PORT}"
  else
    yellow "… starting 'npx convex dev' (local backend on :${CONVEX_PORT})"
    # Detached so it survives this script; logs to a known file.
    ( npx convex dev >/tmp/sprtsmng-convex-local.log 2>&1 & )
    for _ in $(seq 1 40); do
      backend_up && break
      if grep -qiE "prompt|would you like|select a|choose" /tmp/sprtsmng-convex-local.log 2>/dev/null; then
        red "✖ 'npx convex dev' needs interactive setup. Run it once in its own"
        red "  terminal, answer the prompts, then re-run this script."
        exit 1
      fi
      sleep 3
    done
    if backend_up; then green "✓ Convex local backend ready on :${CONVEX_PORT}"; else
      red "✖ Convex backend did not come up. See /tmp/sprtsmng-convex-local.log"
      exit 1
    fi
  fi
fi

# --- 4. Enable the seed mutations on this backend (idempotent) ---------------
npx convex env set CONVEX_ENABLE_E2E_SEED 1 >/dev/null 2>&1 \
  && green "✓ CONVEX_ENABLE_E2E_SEED=1" \
  || yellow "⚠ could not set CONVEX_ENABLE_E2E_SEED (continuing; seed may fail)"

# --- 5. Free port 3000 so Playwright's webServer serves THIS worktree --------
# reuseExistingServer=true would otherwise attach to a stale server running
# another worktree's code — the silent "old bundle" failure.
STALE="$(lsof -ti :3000 2>/dev/null || true)"
if [[ -n "$STALE" ]]; then
  yellow "… freeing port 3000 (stale dev server: $STALE)"
  echo "$STALE" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# --- 6. Run Playwright --------------------------------------------------------
green "▶ playwright test ${*:-<full suite>}"
ARGS=(test --config e2e/playwright.config.ts)
[[ "${HEADED:-0}" == "1" ]] && ARGS+=(--headed)
exec pnpm exec playwright "${ARGS[@]}" "$@"
