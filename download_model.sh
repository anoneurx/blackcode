#!/bin/bash

MODEL_DIR="models"
MODEL_FILE="qwen2.5-coder-7b-instruct.gguf"
# Fallback smaller model if requested: Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF
# We use the 7B URL since that's what the extension expects by default.

echo "🔍 Checking for model directory..."
mkdir -p "$MODEL_DIR"

if [ -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "✅ Model already exists."
    exit 0
fi

echo "🚀 Downloading Qwen2.5-Coder 7B (Simplified GGUF)..."
echo "Note: This is a large file (~4.7GB). Please wait..."

# Direct link to a reliable Q4_K_M GGUF
curl -L -o "$MODEL_DIR/$MODEL_FILE" "https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf"

if [ $? -eq 0 ]; then
    echo "✅ Download complete! You can now use Black Code."
else
    echo "❌ Download failed. Please check your internet connection."
    exit 1
fi
