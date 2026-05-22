# Black Code
![Black Code](media/github-readme.png)


Black Code is a premium offline AI coding assistant. This repository contains the complete source code for both the VS Code extension and the high-performance Rust inference engine.

---

## Project Structure

| Directory | Description |
|-----------|-------------|
| `/frontend` | VS Code Extension UI (generates the `.vsix` file) |
| `/backend` | High-performance Rust inference server |
| `/core` | Shared logic, codebase indexing, and AI protocols |
| `/packages` | Internal shared packages and utilities |
| `/models` | **(Local only)** Directory for your GGUF model files |

---

## AI Model Setup

> **The `models/` folder is NOT included in this repository.** It contains large GGUF files (several GB each) excluded by `.gitignore`. You must download a model before running the backend.

### Option A — Automatic Download (Recommended)
```bash
chmod +x download_model.sh
./download_model.sh
```
This downloads `qwen2.5-coder-7b-instruct.gguf` (~4.7 GB) into the `models/` directory automatically.

### Option B — Manual Download
Download any compatible GGUF from [Hugging Face](https://huggingface.co/models?library=gguf) and place it in `models/`:
```
blackcode/
└── models/
    └── your-model.gguf
```

**Recommended models:**

| Edition | Model | Size |
|---------|-------|------|
| Default | [Qwen2.5-Coder-7B-Instruct Q4_K_M](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF) | ~4.7 GB |
| Pro | [Qwen2.5-Coder-7B Q8](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF) | ~7.7 GB |
| Lite | [Qwen2.5-Coder-0.5B](https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF) | ~0.5 GB |

---

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/anoneurx/blackcode.git
cd blackcode
```

### 2. Download a Model
```bash
./download_model.sh
```

### 3. Build the Project
Ensure you have **Rust**, **Cargo**, and **Node.js** installed, then run:
```bash
./build.sh
```

### 4. Run the Backend
```bash
cd backend
cargo run --release -- --model ../models/qwen2.5-coder-7b-instruct.gguf
```

### 5. Install the Extension
Install the extension from the marketplace: [Black Code Extension](https://marketplace.visualstudio.com/items?itemName=anoneurx.black-code)

---

## Configuration
In VS Code settings (`blackcode.*`):

| Setting | Default | Description |
|---------|---------|-------------|
| `blackcode.backendUrl` | `ws://127.0.0.1:7777` | URL of the backend server |
| `blackcode.model` | `Black Code Beta Default` | Active AI model edition |
| `blackcode.betaPath` | `models/qwen2.5-coder-7b-instruct.gguf` | Path to Default model |
| `blackcode.proPath` | `models/qwen2.5-coder-7b-pro.gguf` | Path to Pro model |
| `blackcode.litePath` | `models/qwen2.5-coder-0.5b-lite.gguf` | Path to Lite model |

---

## License
This project is licensed under the **Apache License 2.0** — see the [LICENSE](LICENSE) file for details.

Copyright © 2026 Black Code. All Rights Reserved By Anoneurx.
