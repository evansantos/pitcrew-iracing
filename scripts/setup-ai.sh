#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🤖 iRacing Race Engineer - AI Setup Script"
echo "==========================================="
echo ""

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓ Ollama is already installed${NC}"
    OLLAMA_VERSION=$(ollama --version 2>&1 || echo "unknown")
    echo "  Version: $OLLAMA_VERSION"
else
    echo -e "${YELLOW}⚠ Ollama is not installed${NC}"
    echo ""
    echo "Installing Ollama..."

    # Detect OS and install
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "Detected macOS - installing via Homebrew..."
        if command -v brew &> /dev/null; then
            brew install ollama
            echo -e "${GREEN}✓ Ollama installed via Homebrew${NC}"
        else
            echo -e "${RED}✗ Homebrew not found. Please install from: https://brew.sh${NC}"
            echo "Or download Ollama from: https://ollama.ai/download"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo "Detected Linux - installing via official script..."
        curl -fsSL https://ollama.ai/install.sh | sh
        echo -e "${GREEN}✓ Ollama installed${NC}"
    else
        echo -e "${RED}✗ Unsupported OS: $OSTYPE${NC}"
        echo "Please install Ollama manually from: https://ollama.ai/download"
        exit 1
    fi
fi

echo ""
echo "Checking if Ollama service is running..."

# Check if Ollama is running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama service is running${NC}"
else
    echo -e "${YELLOW}⚠ Ollama service is not running${NC}"
    echo "Starting Ollama in the background..."

    # Start Ollama in background
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - start as background service
        brew services start ollama 2>/dev/null || {
            echo "Starting Ollama manually..."
            nohup ollama serve > /tmp/ollama.log 2>&1 &
            sleep 3
        }
    else
        # Linux - start in background
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        sleep 3
    fi

    # Verify it started
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama service started${NC}"
    else
        echo -e "${RED}✗ Failed to start Ollama service${NC}"
        echo "Please start manually: ollama serve"
        exit 1
    fi
fi

echo ""
echo "Checking for AI models..."

# Check if models are installed
MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")

if echo "$MODELS" | grep -q "llama3.1:8b"; then
    echo -e "${GREEN}✓ llama3.1:8b model is already installed${NC}"
elif echo "$MODELS" | grep -q "phi3:mini"; then
    echo -e "${GREEN}✓ phi3:mini model is already installed${NC}"
else
    echo -e "${YELLOW}⚠ No AI models found${NC}"
    echo ""
    echo "Which model would you like to install?"
    echo "  1) llama3.1:8b (Recommended - 4GB RAM, good quality)"
    echo "  2) phi3:mini (Lite - 2GB RAM, faster but lower quality)"
    echo "  3) Skip model installation"
    echo ""
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            echo "Pulling llama3.1:8b (this may take a few minutes)..."
            ollama pull llama3.1:8b
            echo -e "${GREEN}✓ llama3.1:8b installed${NC}"
            ;;
        2)
            echo "Pulling phi3:mini..."
            ollama pull phi3:mini
            echo -e "${GREEN}✓ phi3:mini installed${NC}"
            ;;
        3)
            echo "Skipping model installation. You can install later with:"
            echo "  ollama pull llama3.1:8b"
            ;;
        *)
            echo -e "${YELLOW}Invalid choice. Skipping model installation.${NC}"
            ;;
    esac
fi

echo ""
echo "Verifying setup..."

# Final verification
FINAL_MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")
MODEL_COUNT=$(echo "$FINAL_MODELS" | grep -c ":" || echo "0")

echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Summary:"
echo "  Ollama version: $(ollama --version 2>&1 || echo 'unknown')"
echo "  Service status: Running"
echo "  Models installed: $MODEL_COUNT"

if [ "$MODEL_COUNT" -gt 0 ]; then
    echo ""
    echo "Available models:"
    echo "$FINAL_MODELS" | while read -r model; do
        [ -n "$model" ] && echo "  - $model"
    done
fi

echo ""
echo -e "${GREEN}🎉 AI Race Engineer is ready to use!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the backend: pnpm --filter @iracing-race-engineer/api dev"
echo "  2. Start the frontend: pnpm --filter @iracing-race-engineer/web dev"
echo "  3. Open http://localhost:3002 and look for the 'AI Race Engineer' section"
echo ""
echo "To check AI status anytime: pnpm --filter @iracing-race-engineer/api ai:status"
echo ""
