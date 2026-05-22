# Black Code
**The Ultimate Offline Autonomous AI Coding Suite**

Black Code is an enterprise-grade AI coding assistant that runs 100% locally. No cloud APIs, no data leakage, and zero latency. Powered by a high-performance Rust inference engine.

---

## Product Editions

### Black Code Pro
The professional choice for full-stack developers. Pro handles large-scale refactoring and complex system architecture using high-parameter models. 
*   **Performance**: High Precision.
*   **Memory**: ~6.6GB.

### Black Code Lite
Optimized for speed. Lite provides instant responses for scripting and debugging while maintaining a minimal hardware footprint.
*   **Performance**: Ultra-Fast.
*   **Memory**: ~2.0GB.

---

---

## How it Works
Black Code utilizes a hybrid architecture designed for maximum performance and data privacy:
- **Rust Inference Engine**: A high-performance backend built with Rust and `llama.cpp` handles GGUF model execution locally. It supports GPU acceleration (Metal/CUDA) and multi-threaded CPU execution.
- **Context-Aware Core**: A shared logic layer that indexes your codebase using vector embeddings and tree-sitter, providing the AI with deep structural understanding of your project.
- **VS Code Integration**: A seamless frontend that provides an intuitive chat interface, inline code completions, and automated refactoring tools.

---

## Key Features

### Ultra-Fast Local Autocomplete
Experience zero-latency code completions that understand your project's patterns. Since inference happens locally on your machine, your code never leaves your workspace.

### Deep Codebase Indexing
Black Code indexes your entire repository, allowing the AI to:
- Find relevant files and functions automatically.
- Answer complex questions about system architecture.
- Perform large-scale refactorings with confidence.

### Specialized AI Moods
Switch between specialized profiles tailored for different tasks:
- **General AI**: Your reliable daily coding partner.
- **Bug Specialist**: Optimized for stack trace analysis and surgical bug fixing.
- **Builder Expert**: Focused on boilerplate generation and feature implementation.
- **System Architect**: Best for high-level design, documentation, and roadmaps.

### Model Context Protocol (MCP)
Connect Black Code to external data sources and tools using the standard MCP protocol. Enhance your AI with real-time documentation, database schemas, and more.

### Enterprise-Grade Privacy
Designed for security-conscious developers:
- **100% Offline**: No telemetry, no cloud processing, no data leakage.
- **Session Isolation**: Each conversation is cryptographically isolated.
- **Local GGUF Support**: Use any model from the Qwen, Llama, or Mistral families.

---


## Getting Started

1.  **Install**: Install the generated `.vsix` file into your VS Code.
2.  **Model Setup**: Place your favorite GGUF model (e.g., Qwen2.5-Coder) in the `models/` directory.
3.  **Backend**: Start the high-performance Rust backend:
    ```bash
    ./backend/target/release/blackcode-backend --model models/your-model.gguf
    ```


---

## Repository
The complete source code for Black Code is available on GitHub:
[GitHub Repository](https://github.com/anoneurx/blackcode)

### Clone & Run Locally
To set up Black Code on your own system:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/anoneurx/blackcode.git
    cd blackcode
    ```

2.  **Build the project**:
    Ensure you have Rust and Node.js installed, then run the build script:
    ```bash
    ./build.sh
    ```

3.  **Start the Backend**:
    ```bash
    cd backend
    cargo run --release -- --model ../models/your-model.gguf
    ```

For more detailed setup instructions, including model configuration and development tips, please refer to the documentation in the main repository.

---


## System Requirements
*   **VS Code**: 1.80.0+
*   **RAM**: 8GB Minimum.
*   **CPU**: Modern Multi-core Processor.

---

## License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Black Code. All Rights Reserved By Anoneurx.

