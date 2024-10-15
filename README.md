# DotLaunch

A token launchpad platform for BNB Smart Chain: teams create presales for
their token, investors contribute during a sale window, and funds or refunds
settle on chain when the window closes.

## Layout

| Path        | What it is                                           |
| ----------- | ---------------------------------------------------- |
| `contracts` | Solidity sources, Hardhat config and deploy scripts   |
| `backend`   | Express API and the chain event indexer               |
| `frontend`  | React web app                                         |

## Getting started

Each package is installed and run on its own for now:

```bash
cd contracts && yarn && npx hardhat compile
cd backend   && yarn && yarn start
cd frontend  && yarn && yarn start
```

The API expects MongoDB on `mongodb://127.0.0.1:27017/dotlaunch` and Redis on
`redis://127.0.0.1:6379`. Copy `.env.example` to `.env` to point them
elsewhere.

## Status

Early. The sale contract, the API skeleton and the component library are in
place; the indexer, the creation flow and the token tools are not.
