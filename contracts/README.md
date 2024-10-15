# DotLaunch contracts

Solidity sources, deployment, and the demo seeder. See the
[root README](../README.md) for running the full stack.

## Contracts

| Contract | Role |
| --- | --- |
| `LaunchpadDeployer` | Creates presales, funds each with its sale allocation, and indexes them by token, creator and participant. Emits the events the API's listener consumes. |
| `LaunchPad` | One presale: caps, window, per-wallet limits, contributions, claims, refunds, whitelist, and the finish/cancel lifecycle. |
| `ManageToken` | Token factory. Prices a configuration, charges for it, refunds overpayment, and records what each address deployed. |
| `ManagedStandardToken` | ERC20 with mint/burn/pause/blacklist fixed immutably at creation. |
| `ManagedLiquidityToken` | Fee-on-transfer ERC20 with capped, immutable fees and optional transfer/wallet limits. |
| `SenseiLock` | Token and liquidity locks. |
| `BulkTransfer` | Atomic batch distribution — the whole batch settles or none of it does. |

Two design choices are load-bearing and deliberate:

- **Capability flags and fees are immutable.** The common failure in this
  space is a deployer enabling minting, or raising a sell tax, after a raise
  has closed. Fixing both at construction removes the vector rather than
  documenting it.
- **Limits may only be relaxed, never tightened.** An owner cannot trap
  holders by dropping a transfer cap to zero post-launch.

## Commands

```bash
npm install
npm run compile
npm test            # 88 passing; suites live in ../tests/contracts

npm run deploy:local   # deploy to the local chain
npm run seed:local     # load the demo environment
npm run size           # contract bytecode sizes
```

## Deployment determinism

`scripts/deploy-all.js` deploys in a fixed order from a fixed mnemonic, so a
clean chain always produces the same addresses. It writes them to
`deployments/<network>.json`, which the API reads at startup, and it is
idempotent: run against a chain that already has the contracts and it reports
them and exits rather than deploying a second, conflicting set.

## Keys

The development mnemonic in `hardhat.config.js` is the public
Foundry/Hardhat one. It funds no real account and exists so `anvil`, the
deploy scripts and the tests all derive the same addresses. Real deployments
supply `DEPLOYER_MNEMONIC` or `DEPLOYER_PRIVATE_KEY` through the environment;
nothing sensitive is committed.

## Seeding

`scripts/seed-demo-data.js` walks the chain clock through 45 days of history,
performing the real transactions in order, so every presale state a reviewer
sees is genuine contract state rather than fixture rows. It refuses to run
against anything but a local chain, and refuses to seed a chain that already
has presales on it. The catalogue it builds lives in
`scripts/lib/demo-dataset.js`.
