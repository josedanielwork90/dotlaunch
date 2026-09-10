# Configuration

Every setting is read from the environment. The repository deliberately
contains **no `.env` file of any kind** — `docker-compose.yml` declares each
value inline with a development default, so the stack starts with:

```bash
docker compose up --build -d
```

To change something, export it in your shell or create a local `.env`
(git-ignored) before running Compose:

```bash
WEB_PORT=4000 docker compose up -d
```

Nothing here is a secret. The values below are local-development defaults;
the anvil accounts and contract addresses they reference are public and hold
no real funds.

## Chain

| Variable | Default | Purpose |
| --- | --- | --- |
| `CHAIN_RPC_URL` | `http://anvil:8545` | JSON-RPC endpoint the API talks to |
| `CHAIN_ID` | `31337` | Expected EIP-155 chain id |
| `CHAIN_NAME` | `Localhost` | Label shown in the network selector |
| `CHAIN_CONFIRMATIONS` | `0` | Blocks held back before logs are treated as final. Must be 0 on a chain that only mines on demand, or recent blocks are never indexed |
| `EXPLORER_URL` | `http://localhost:8545` | Root for transaction and address links |
| `NATIVE_SYMBOL` | `ETH` | Native currency symbol |

## Datastores

| Variable | Default |
| --- | --- |
| `MONGO_URL` | `mongodb://mongo:27017/dotlaunch` |
| `REDIS_URL` | `redis://redis:6379` |

## API

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `PORT` | `8888` | |
| `JWT_SECRET` | `dotlaunch-local-development-secret` | Signing key. The API **refuses to start** in production without an explicit value, rather than falling back to this one |
| `JWT_TTL` | `126000` | Token lifetime in seconds |

## Storage

| Variable | Default | Purpose |
| --- | --- | --- |
| `STORAGE_DRIVER` | `local` | `local` writes to disk, so the stack runs with no internet access. `pinata` pins to IPFS and additionally requires `PINATA_JWT` |
| `STORAGE_LOCAL_DIR` | `/app/.storage` | |
| `STORAGE_PUBLIC_BASE_URL` | `http://localhost:8888/api/v1/storage` | |
| `PINATA_JWT` | *(unset)* | Only read when `STORAGE_DRIVER=pinata` |

## Event listener

| Variable | Default | Purpose |
| --- | --- | --- |
| `EVENT_LISTENER_ENABLED` | `true` | |
| `EVENT_LISTENER_BLOCK_RANGE` | `1000` | Maximum blocks per scan |
| `EVENT_LISTENER_CRON` | `*/5 * * * * *` | |
| `EVENT_LISTENER_START_BLOCK` | *(from deployment record)* | Falls back to the block the contracts were deployed in |

## Contracts

Discovered from `contracts/deployments/<network>.json`, written by the deploy
script, so they normally need no configuration. Environment variables
override the record when set.

| Variable | Default |
| --- | --- |
| `CONTRACT_LAUNCHPAD_DEPLOYER` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `CONTRACT_TOKEN_LOCK` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `CONTRACT_TOKEN_MANAGE` | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |
| `CONTRACT_MULTISEND` | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |

These are deterministic: a clean chain plus the public development mnemonic
plus the fixed deployment order always produces them.

## Demo behaviour

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEMO_MODE` | `true` | Offers the built-in demo wallet, so the app is usable with no browser extension. **Never enable against a live network** |
| `FIXED_NOW` | `2025-06-15T12:00:00Z` | Pins the application clock in both the API and the web app. Leave empty to follow real time, which is what a real deployment does |
| `DEMO_CHAIN_TIMESTAMP` | `1746100800` | Anvil genesis, 45 days before `FIXED_NOW`, giving the seeder room to replay history |

## Host ports

Override any of these if one collides with something already running.

| Variable | Default |
| --- | --- |
| `WEB_PORT` | `3000` |
| `API_PORT` | `8888` |
| `ANVIL_PORT` | `8545` |
| `MONGO_PORT` | `27018` |

## Deployment credentials

Never committed. Supply through the environment when deploying to a real
network:

- `DEPLOYER_MNEMONIC`
- `DEPLOYER_PRIVATE_KEY`

Without them, the contracts package falls back to the public
Foundry/Hardhat development mnemonic, which funds no real account.
