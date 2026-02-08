#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking src/ for forbidden browser Edge Function usage..."

if command -v rg >/dev/null 2>&1; then
  matches="$(rg -n --no-heading --color never -e 'supabase\.functions\.invoke' -e 'functions/v1' src || true)"
else
  matches="$(grep -RInE -- 'supabase\.functions\.invoke|functions/v1' src || true)"
fi

if [[ -n "$matches" ]]; then
  echo "FAIL: Found forbidden Edge Function usage in frontend code:"
  echo "$matches"
  exit 1
fi

echo "PASS: No forbidden Edge Function usage found in src/."
