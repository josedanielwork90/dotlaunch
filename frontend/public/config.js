/**
 * Runtime configuration stub.
 *
 * Overwritten at container start by docker/entrypoint.sh. When running the
 * dev server directly this stays empty and src/utils/runtimeConfig.ts falls
 * back to REACT_APP_* build-time variables.
 */
window.__DOTLAUNCH_CONFIG__ = window.__DOTLAUNCH_CONFIG__ || {};
