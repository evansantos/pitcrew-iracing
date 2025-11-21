#!/bin/bash

# Database migration script
# Usage: ./scripts/db-migrate.sh [up|down|create]

set -e

ACTION=${1:-up}

case $ACTION in
  up)
    echo "Running database migrations..."
    pnpm --filter @iracing-race-engineer/api drizzle-kit migrate
    echo "✅ Migrations complete"
    ;;
  down)
    echo "Rolling back last migration..."
    pnpm --filter @iracing-race-engineer/api drizzle-kit migrate:down
    echo "✅ Rollback complete"
    ;;
  create)
    if [ -z "$2" ]; then
      echo "Usage: ./scripts/db-migrate.sh create <migration_name>"
      exit 1
    fi
    echo "Creating new migration: $2"
    pnpm --filter @iracing-race-engineer/api drizzle-kit generate --name "$2"
    echo "✅ Migration created"
    ;;
  *)
    echo "Usage: ./scripts/db-migrate.sh [up|down|create <name>]"
    exit 1
    ;;
esac
