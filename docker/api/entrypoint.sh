#!/bin/sh
set -e

echo "Running database migrations..."
cd /app
pnpm --filter @iracing-race-engineer/api db:push || true

echo "Starting API server..."
exec node apps/api/dist/index.js
