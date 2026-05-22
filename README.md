# Black Code
![Black Code](media/github-readme.png)

**Repository**: [GitHub Repository](https://github.com/anoneurx/blackcode)
**Marketplace**: [Black Code Extension](https://marketplace.visualstudio.com/items?itemName=anoneurx.black-code)

Black Code is a premium offline AI coding assistant.
 This repository contains the complete source code for both the VS Code extension and the high-performance inference engine.

## Project Structure

- **`/frontend`**: The VS Code Extension UI (generates the `.vsix` file).
- **`/backend`**: The high-performance Rust server (models/brains).
- **`/core`**: Shared logic, indexing, and core AI protocols.
- **`/models`**: (Local only) Directory for your GGUF model files.

## Quick Start

### 1. Build the Project
Run the unified build script to compile both the backend and the extension:
```bash
./build.sh
```

### 2. Run the Backend (Model Brain)
```bash
cd backend
cargo run --release -- --model ../models/qwen2.5-coder-7b-instruct.gguf
```

### 3. Install the Extension
Install the generated `.vsix` file in VS Code.

## Configuration
In VS Code settings:
- `blackcode.backendUrl`: URL of your backend server (default: `ws://127.0.0.1:7777`).
- `blackcode.model`: Select your active AI model (Default, Pro, or Lite).

## License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

