import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { WebSocket } from 'ws';

let backendProcess: cp.ChildProcess | undefined;
let globalWs: WebSocket | undefined;
let currentSessionId = Math.random().toString(36).substring(7);
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Black Code");
    outputChannel.appendLine('Black Code extension is now active!');

    startBackend(context);
    checkModel(context);

    // Restart backend on config change
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('blackcode')) {
            outputChannel.appendLine("[INFO] Configuration changed, restarting backend...");
            if (backendProcess) {
                backendProcess.kill();
                backendProcess = undefined;
            }
            await startBackend(context);
        }
    }));

    const provider = new BlackCodeViewProvider(context);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'blackcode.blackcodeGUIView',
            provider
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('blackcode.applyCode', (code: string) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, code);
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('blackcode.createFile', async (filePath: string, content: string) => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage("No workspace folder open.");
                    return;
                }
                const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolders[0].uri.fsPath, filePath);
                const dir = path.dirname(fullPath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(fullPath, content);
                const doc = await vscode.workspace.openTextDocument(fullPath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`File created: ${path.basename(fullPath)}`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Failed to create file: ${e.message}`);
            }
        })
    );
}

class BlackCodeViewProvider implements vscode.WebviewViewProvider {
    private readonly _extensionUri: vscode.Uri;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._extensionUri = _context.extensionUri;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'webview'),
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'runAgent':
                    this._handleChat(data, webviewView);
                    break;
                case 'getContext':
                    this._sendContext(webviewView);
                    break;
                case 'applyCode':
                    vscode.commands.executeCommand('blackcode.applyCode', data.value);
                    break;
                case 'getHistory': {
                    const history = this._context.globalState.get<any[]>('blackcode.history', []);
                    webviewView.webview.postMessage({ type: 'history', value: history });
                    break;
                }
                case 'saveToHistory':
                    this._saveToHistory(data.value);
                    break;
                case 'stopInference':
                    if (globalWs) {
                        globalWs.terminate();
                        globalWs = undefined;
                    }
                    break;
                case 'newChat':
                    currentSessionId = Math.random().toString(36).substring(7);
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'blackcode');
                    break;
                case 'readFile':
                    this._readFile(data.path, webviewView);
                    break;
                case 'createFile':
                    vscode.commands.executeCommand('blackcode.createFile', data.path, data.content);
                    break;
                case 'listFiles':
                    this._listFiles(data.path, webviewView);
                    break;
            }
        });
    }

    private async _readFile(filePath: string, webviewView: vscode.WebviewView) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolders[0].uri.fsPath, filePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                webviewView.webview.postMessage({ type: 'fileContent', path: filePath, content: content });
            }
        } catch (e) {}
    }

    private async _listFiles(dirPath: string, webviewView: vscode.WebviewView) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;
            const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(workspaceFolders[0].uri.fsPath, dirPath);
            if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
                const files = fs.readdirSync(fullPath);
                webviewView.webview.postMessage({ type: 'fileList', path: dirPath, files: files });
            }
        } catch (e) {}
    }

    private async _handleChat(data: any, webviewView: vscode.WebviewView) {
        let prompt = data.value;
        const assistantMood = data.assistant || 'Auto';

        let systemPrompt = "";
        
        switch(assistantMood) {
            case 'Senior Architect':
                systemPrompt = `You are the Senior Architect. Your goal is to provide clean code, solid patterns, and architectural insights.
You have the ability to read and create files in the workspace.
- To read a file, output: [READ ./path/to/file]
- To create a file, just output the code block and the user can save it using the "Save" button.
Be extremely thorough and precise. Use Markdown for all structures.`;
                break;
            case 'Creative':
                systemPrompt = "You are the Creative Assistant. Find novel ways to solve problems and provide unique, optimized solutions.";
                break;
            case 'General':
                systemPrompt = `You are Black Code, a premium autonomous AI coding assistant.
You can help the user by generating production-ready code and refactoring existing projects.

Guidelines:
1. Always use proper Markdown for readability:
   - Fenced code blocks with language identifiers.
   - Tables for comparisons or structured data.
   - Bold and lists for emphasis.
2. You can request to read files if you need more context (e.g. "To give a better answer, I need to see your index.ts. [READ src/index.ts]").
3. Focus on security, efficiency, and clean code.
4. When generating multiple files, clearly label them.`;
                break;
            default:
                systemPrompt = "You are Black Code, an AI coding assistant. Provide accurate and concise code solutions.";
                break;
        }

        const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;
        const config = vscode.workspace.getConfiguration('blackcode');
        const backendUrl = config.get<string>('backendUrl') || 'ws://127.0.0.1:7777';
        const ws = new WebSocket(`${backendUrl}/api/stream`);
        globalWs = ws;
        let currentResponse = "";
        let isConnected = false;

        const connectionTimeout = setTimeout(() => {
            if (!isConnected) {
                ws.terminate();
                webviewView.webview.postMessage({ type: 'token', value: "\n\n**ERROR**: Connection timeout. Ensure backend is running. (Model might still be loading, please try again in a moment)" });
                webviewView.webview.postMessage({ type: 'status', value: 'offline' });
            }
        }, 60000); // 60 seconds for 7B models

        ws.on('open', () => {
            isConnected = true;
            clearTimeout(connectionTimeout);
            ws.send(JSON.stringify({ 
                prompt: fullPrompt,
                session_id: currentSessionId
            }));
            webviewView.webview.postMessage({ type: 'status', value: 'online' });
        });

        ws.on('close', () => {
            if (globalWs === ws) globalWs = undefined;
            
            if (currentResponse.length > 0) {
                this._saveToHistory({
                    prompt: prompt,
                    response: currentResponse,
                    timestamp: new Date().toLocaleTimeString(),
                    mood: assistantMood
                });
            }
            
            webviewView.webview.postMessage({ type: 'status', value: 'offline' });
        });

        ws.on('message', async (messageBuffer: any) => {
            try {
                const data = JSON.parse(messageBuffer.toString());
                const token = data.token;
                
                if (data.done) {
                    webviewView.webview.postMessage({ type: 'status', value: 'online' });
                    return;
                }

                currentResponse += token;
                webviewView.webview.postMessage({ type: 'token', value: token });
            } catch (e) {
                const rawToken = messageBuffer.toString();
                if (!rawToken.includes("{")) {
                     webviewView.webview.postMessage({ type: 'token', value: rawToken });
                }
            }
        });

        ws.on('error', (err: any) => {
            webviewView.webview.postMessage({ type: 'status', value: 'offline' });
        });
    }

    private _saveToHistory(item: any) {
        const history = this._context.globalState.get<any[]>('blackcode.history', []);
        history.unshift(item); // Newest first
        if (history.length > 50) history.pop();
        this._context.globalState.update('blackcode.history', history);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        try {
            const htmlPath = path.join(this._extensionUri.fsPath, 'index.html');
            let html = fs.readFileSync(htmlPath, 'utf8');
            
            // Resolve URIs
            const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'logo.png'));
            const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'webview.css'));
            const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'webview.js'));

            html = html.replace('[[WEBVIEW_CSS]]', cssUri.toString());
            html = html.replace('[[WEBVIEW_JS]]', jsUri.toString());
            html = html.replace('[[LOGO_URI]]', logoUri.toString());
            
            return html;
        } catch (e: any) {
            return `<html><body>Error loading view: ${e.message}</body></html>`;
        }
    }

    private _sendContext(webviewView: vscode.WebviewView) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection);
            webviewView.webview.postMessage({ type: 'context', value: text || editor.document.getText() });
        }
    }
}

async function startBackend(context: vscode.ExtensionContext) {
    const isProduction = context.extensionMode === vscode.ExtensionMode.Production;
    
    let backendPath = path.join(context.extensionUri.fsPath, 'bin', 'blackcode-backend');
    
    // Fallback for development (if bin/ not yet populated)
    if (!fs.existsSync(backendPath)) {
        const devPath = path.join(context.extensionUri.fsPath, '..', '..', 'blackcode-backend', 'target', 'release', 'blackcode-backend');
        if (fs.existsSync(devPath)) {
            backendPath = devPath;
        }
    }
    
        outputChannel.appendLine(`[INFO] Resolved backend path: ${backendPath}`);
        if (!fs.existsSync(backendPath)) {
            outputChannel.appendLine(`[ERROR] Backend binary does NOT exist at: ${backendPath}`);
        }

    if (fs.existsSync(backendPath)) {
        outputChannel.appendLine(`[INFO] Starting backend process...`);
        
        // Ensure executable permissions
        try {
            fs.chmodSync(backendPath, '755');
        } catch (e) {
            outputChannel.appendLine(`[WARN] Failed to set permissions: ${e}`);
        }

        // Get configured model and its specific path
        const config = vscode.workspace.getConfiguration('blackcode');
        const selectedModel = config.get<string>('model') || "Black Code Beta Default";
        
        let modelPath = "models/qwen2.5-coder-7b-instruct.gguf";
        if (selectedModel === "Black Code Pro") modelPath = config.get<string>('proPath') || "models/qwen2.5-coder-7b-pro.gguf";
        else if (selectedModel === "Black Code Lite") modelPath = config.get<string>('litePath') || "models/qwen2.5-coder-0.5b-lite.gguf";
        else modelPath = config.get<string>('betaPath') || "models/qwen2.5-coder-7b-instruct.gguf";

        // Resolve relative paths
        if (!path.isAbsolute(modelPath)) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let resolved = false;

            // 1. Check workspace root
            if (workspaceFolders) {
                const workspacePath = path.join(workspaceFolders[0].uri.fsPath, modelPath);
                if (fs.existsSync(workspacePath)) {
                    modelPath = workspacePath;
                    resolved = true;
                }
            }

            // 2. Check extension root (fallback)
            if (!resolved) {
                const extensionPath = path.join(context.extensionUri.fsPath, modelPath);
                if (fs.existsSync(extensionPath)) {
                    modelPath = extensionPath;
                }
            }
        }

        // Cleanup logic for port 7777
        try {
            if (process.platform === 'linux' || process.platform === 'darwin') {
                cp.execSync('fuser -k 7777/tcp || true');
            }
        } catch (e) {
            outputChannel.appendLine(`[INFO] Port cleanup attempt finished: ${e}`);
        }

        outputChannel.appendLine(`[INFO] Final Resolved Model Path: ${modelPath}`);
        
        backendProcess = cp.spawn(backendPath, ["--model", modelPath], { 
            cwd: path.dirname(backendPath),
            env: { ...process.env, PORT: "7777" }
        });

        backendProcess.stdout?.on('data', (data) => {
            outputChannel.appendLine(`[BACKEND] ${data.toString()}`);
        });

        backendProcess.stderr?.on('data', (data) => {
            const msg = data.toString();
            outputChannel.appendLine(`[BACKEND ERROR] ${msg}`);
            if (msg.includes("Address already in use")) {
                outputChannel.appendLine("[ERROR] Port 7777 is still busy. Please kill any process using port 7777 and restart VS Code.");
            }
        });

        backendProcess.on('close', (code) => {
            outputChannel.appendLine(`[INFO] Backend process exited with code ${code}`);
            backendProcess = undefined;
        });

        backendProcess.on('error', (err) => {
            outputChannel.appendLine(`[ERROR] Failed to start backend: ${err.message}`);
        });

        backendProcess.on('exit', (code) => {
            outputChannel.appendLine(`[INFO] Backend exited with code ${code}`);
        });
    } else {
        outputChannel.appendLine(`[ERROR] Backend binary not found at ${backendPath}`);
    }
}


export function deactivate() {
    if (backendProcess) backendProcess.kill();
}

async function checkModel(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('blackcode');
    const modelPath = config.get<string>('modelPath') || "";
    
    // Check if path exists (handle absolute or relative)
    let found = false;
    if (!path.isAbsolute(modelPath)) {
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspace && fs.existsSync(path.join(workspace, modelPath))) {
            found = true;
        }
        const projectRoot = path.join(context.extensionUri.fsPath, '..', '..');
        if (fs.existsSync(path.join(projectRoot, modelPath))) {
            found = true;
        }
    } else if (fs.existsSync(modelPath)) {
        found = true;
    }

    if (!found) {
        const selection = await vscode.window.showWarningMessage(
            "Black Code: AI Model file not found. Inference will fail.",
            "How to Fix"
        );
        if (selection === "How to Fix") {
            vscode.env.openExternal(vscode.Uri.parse("https://docs.black-code.ai/getting-started/model-setup"));
        }
    }
}

