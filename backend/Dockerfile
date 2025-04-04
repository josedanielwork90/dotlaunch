# DotLaunch API: Express + MongoDB, plus the on-chain event listener.
FROM node:18-bullseye-slim

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

COPY src ./src

# Local upload storage; mounted as a volume in compose so uploads survive
# a container restart.
RUN mkdir -p /app/.storage

ENV NODE_ENV=production
ENV PORT=8888
EXPOSE 8888

CMD ["node", "src/app.js"]
