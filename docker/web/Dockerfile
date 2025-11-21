FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Build shared package
RUN pnpm --filter @iracing-race-engineer/shared build

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm --filter @iracing-race-engineer/web build

# Production image
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy built files
COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/package.json ./apps/web/
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000

CMD ["pnpm", "--filter", "@iracing-race-engineer/web", "start"]
