# DotLaunch web app

React 17 + TypeScript, built with Create React App via craco. See the
[root README](../README.md) for running the full stack — this package is
served by nginx in the `web` container and is not normally run on its own.

## Commands

```bash
npm install
npm start          # dev server on :3000
npm run build      # production build
npm test           # 39 passing; suites live in ../tests/frontend
npm run lint
npm run typecheck
```

## Runtime configuration

A CRA bundle normally freezes `process.env.REACT_APP_*` at build time, which
means one image per environment. Instead the container writes
`public/config.js` on startup and [`src/utils/runtimeConfig.tsx`](src/utils/runtimeConfig.tsx)
reads it, so the same built bundle can be pointed at a local chain, a testnet
or production by restarting rather than rebuilding.

Resolution order for every value: injected config, then `REACT_APP_*`, then a
local-development default. Nothing else in the app reads `process.env`
directly.

## The application clock

Everything time-derived — countdowns, relative timestamps, whether a sale is
upcoming, live or closed — reads `now()` from `runtimeConfig` rather than
`Date.now()`. With `FIXED_NOW` configured the whole interface renders against
a known instant, which is what makes the seeded environment reproducible.
Unset, it follows the system clock.

## Wallets

Three wallet types sit behind [`src/services/wallet`](src/services/wallet):
an injected extension, WalletConnect, and a built-in demo wallet backed by
the local chain. Nothing downstream knows which is active.

The demo wallet exists because the app is wallet-gated: with no extension
installed there is otherwise no way to reach any screen. It holds no key
material — a local node keeps its accounts unlocked and signs on their behalf
— and its constructor refuses any chain id that is not a known local one.

## A toolchain constraint worth knowing

This package builds on react-scripts 4, whose Babel pipeline does **not**
accept some TypeScript-only syntax. Type annotations, interfaces and generics
are fine; `x as T`, `declare global` and member modifiers such as `private`
fail with misleading "unexpected token" errors, in `.ts` and `.tsx` alike.

That is why there is not a single type assertion in this codebase. Where one
would normally be used, an `any` parameter on a small helper keeps the
untyped access confined to one reviewed place with a typed return — see
`readInjected` in `runtimeConfig.tsx` and the helpers in `utils/errors.tsx`.
