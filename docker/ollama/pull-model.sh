#!/bin/bash

# Wait for Ollama to be ready
echo "Waiting for Ollama service to start..."
while ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 2
done
echo "Ollama service is ready!"

# Pull the default model if specified
MODEL=${OLLAMA_MODEL:-llama3.1:8b}

echo "Checking if model '$MODEL' is already available..."
if curl -s http://localhost:11434/api/tags | grep -q "$MODEL"; then
  echo "✓ Model '$MODEL' is already pulled"
else
  echo "Pulling model '$MODEL' (this may take several minutes)..."
  ollama pull "$MODEL"
  echo "✓ Model '$MODEL' pulled successfully"
fi

echo "Available models:"
ollama list
