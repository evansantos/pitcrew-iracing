#!/bin/bash

# iRacing Race Engineer - Development Setup Script
# This script helps you get started with the project

set -e

echo "🏎️  iRacing Race Engineer - Setup Script"
echo "========================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22.x or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "❌ Node.js version must be 22.x or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) found"

if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm $(pnpm -v) found"

if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You'll need to install PostgreSQL and Redis manually."
else
    echo "✅ Docker found"
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "📝 Setting up environment..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from template"
    echo "⚠️  Please edit .env.local with your configuration"
else
    echo "ℹ️  .env.local already exists"
fi

echo ""
echo "🗄️  Setting up databases..."
if command -v docker &> /dev/null; then
    docker-compose up -d postgres redis
    echo "✅ PostgreSQL and Redis started in Docker"
    echo ""
    echo "Waiting for databases to be ready..."
    sleep 5
else
    echo "⚠️  Docker not found. Please start PostgreSQL and Redis manually."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your configuration"
echo "  2. Run 'pnpm dev' to start development servers"
echo "  3. Open http://localhost:3002 in your browser"
echo ""
echo "For more information, see README.md"
