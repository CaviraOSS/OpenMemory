# syntax=docker/dockerfile:1
#      __                      __  ___
#     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
#    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
#   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
#  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
#                      /____/                                 /____/
#
#  cavira oss (c) 2026  -  nullure (c) 2026
#  ----------------------------------------------------------
#  file  : Dockerfile
#  usage : supports LongMemory dockerfile

FROM node:22-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json README.md LICENSE ./
COPY apps/vscode-extension/package.json apps/vscode-extension/package.json
COPY integrations/n8n-nodes-longmemory/package.json integrations/n8n-nodes-longmemory/package.json
RUN pnpm install --frozen-lockfile

COPY src ./src
COPY docs ./docs
RUN pnpm build && pnpm pack --pack-destination /tmp/package

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    LONGMEMORY_HOST=0.0.0.0 \
    LONGMEMORY_DB_PATH=/data/longmemory.db \
    LONGMEMORY_MCP_HTTP=true
WORKDIR /app
RUN groupadd --system longmemory \
    && useradd --system --gid longmemory --home /app longmemory \
    && mkdir -p /data \
    && chown longmemory:longmemory /data
COPY --from=build /tmp/package/*.tgz /tmp/longmemory.tgz
RUN npm install --omit=dev /tmp/longmemory.tgz && rm /tmp/longmemory.tgz
USER longmemory
VOLUME ["/data"]
EXPOSE 7331
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "const p=process.env.LONGMEMORY_PORT||process.env.PORT||7331;fetch('http://127.0.0.1:'+p+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/longmemory", "serve", "--mcp-http"]
