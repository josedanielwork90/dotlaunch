# DotLaunch web app.
#
# Stage 1 builds the Create React App bundle on Node 16 — the toolchain here
# is react-scripts 4 / webpack 4, which does not run on newer Node. Pinning
# it in the image means the build is reproducible regardless of what the host
# has installed.
#
# Stage 2 serves the static bundle with nginx. Contract addresses and feature
# flags are written into config.js at container start, not baked into the
# bundle, so one image works against any chain.

FROM node:16-bullseye-slim AS build

WORKDIR /app

COPY package.json package-lock.json* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund --legacy-peer-deps; \
    else npm install --no-audit --no-fund --legacy-peer-deps; fi

COPY tsconfig.json craco.config.js ./
COPY public ./public
COPY src ./src

# CI=true would turn lint warnings into build failures; warnings are reported
# by `npm run lint` instead, which is where they belong.
ENV CI=false
ENV GENERATE_SOURCEMAP=false
# Note: no --openssl-legacy-provider here. That flag works around OpenSSL 3
# breaking webpack 4's md4 hashing on Node 17+; on Node 16 it is both
# unnecessary and rejected outright by the runtime.
RUN npm run build


FROM nginx:1.25-alpine AS runtime

COPY --from=build /app/build /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-dotlaunch-config.sh
RUN chmod +x /docker-entrypoint.d/40-dotlaunch-config.sh

EXPOSE 80
