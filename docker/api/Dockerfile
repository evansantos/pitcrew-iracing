FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build
RUN pnpm --filter @iracing-race-engineer/shared build
RUN pnpm --filter @iracing-race-engineer/api build

# Production image
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# Copy built files
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/pnpm-lock.yaml ./

# Copy entrypoint script
COPY ./docker/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install all dependencies (including dev dependencies for tsx)
RUN pnpm install --frozen-lockfile

EXPOSE 3000 3001

ENTRYPOINT ["/entrypoint.sh"]
