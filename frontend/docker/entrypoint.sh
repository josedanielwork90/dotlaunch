#!/bin/sh
# Writes the runtime configuration the app reads on boot.
#
# Runs from nginx's /docker-entrypoint.d/ on every container start, before
# nginx itself starts. Contract addresses come from the environment, which
# compose populates from .env.docker — so re-pointing the app at a different
# chain is a restart, not a rebuild.
set -eu

CONFIG_FILE=/usr/share/nginx/html/config.js

# fixedNow is a JSON value, not a string field: either a quoted instant or a
# bare null. Build it here rather than inline, so an unset variable produces
# valid JavaScript either way.
if [ -n "${FIXED_NOW:-}" ]; then
  FIXED_NOW_JSON="\"${FIXED_NOW}\""
else
  FIXED_NOW_JSON="null"
fi

# Normalise the boolean so a value like "1" or "yes" still emits valid JS.
case "$(echo "${DEMO_MODE:-false}" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on) DEMO_MODE_JSON="true" ;;
  *)             DEMO_MODE_JSON="false" ;;
esac

cat > "$CONFIG_FILE" <<JS
// Generated at container start by docker/entrypoint.sh. Do not edit.
window.__DOTLAUNCH_CONFIG__ = {
  apiBaseUrl: "${API_BASE_URL:-http://localhost:8888/api/v1}",
  chainRpcUrl: "${CHAIN_RPC_URL:-http://localhost:8545}",
  chainId: ${CHAIN_ID:-31337},
  chainName: "${CHAIN_NAME:-Localhost}",
  explorerUrl: "${EXPLORER_URL:-http://localhost:8545}",
  nativeSymbol: "${NATIVE_SYMBOL:-ETH}",
  storageBaseUrl: "${STORAGE_PUBLIC_BASE_URL:-http://localhost:8888/api/v1/storage}",
  contracts: {
    deployer: "${CONTRACT_LAUNCHPAD_DEPLOYER:-}",
    tokenLock: "${CONTRACT_TOKEN_LOCK:-}",
    tokenManage: "${CONTRACT_TOKEN_MANAGE:-}",
    tokenMultisend: "${CONTRACT_MULTISEND:-}"
  },
  demoMode: ${DEMO_MODE_JSON},
  fixedNow: ${FIXED_NOW_JSON}
};
JS

echo "[dotlaunch] runtime config written to ${CONFIG_FILE}"
