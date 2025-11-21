#!/bin/bash

echo "🧪 Testing iRacing Race Engineer Setup"
echo "======================================"
echo ""

# Test 1: Type checking
echo "1️⃣  Type Checking..."
if pnpm type-check > /dev/null 2>&1; then
    echo "   ✅ Type checking passed"
else
    echo "   ❌ Type checking failed"
    exit 1
fi

# Test 2: Build shared package
echo "2️⃣  Building shared package..."
if pnpm --filter @iracing-race-engineer/shared build > /dev/null 2>&1; then
    echo "   ✅ Shared package built successfully"
else
    echo "   ❌ Shared package build failed"
    exit 1
fi

# Test 3: Build API
echo "3️⃣  Building API..."
if pnpm --filter @iracing-race-engineer/api build > /dev/null 2>&1; then
    echo "   ✅ API built successfully"
else
    echo "   ❌ API build failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "✅ Your setup is working perfectly!"
echo ""
echo "Next steps:"
echo "  1. Run 'pnpm dev' to start development"
echo "  2. Open http://localhost:3002 in your browser"
echo "  3. Start building amazing features!"
echo ""
