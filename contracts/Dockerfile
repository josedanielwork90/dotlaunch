# Compiles the Solidity sources and runs the deploy/seed scripts against the
# local chain. Used by the one-shot `deployer` and `seed` compose services.
FROM node:18-bullseye-slim

WORKDIR /app

# Dependencies first so the (slow) install layer is cached independently of
# contract edits.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Pre-download the solc binary at build time. The deploy step then needs no
# network access at all, which is what lets the stack run fully offline.
COPY hardhat.config.js ./
COPY contracts ./contracts
RUN npx hardhat compile

COPY scripts ./scripts
COPY test ./test

ENV CHAIN_RPC_URL=http://anvil:8545
ENV CHAIN_ID=31337

CMD ["npx", "hardhat", "run", "--network", "localhost", "scripts/deploy-all.js"]
