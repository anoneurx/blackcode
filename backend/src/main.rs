use anyhow::{Context, Result};
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures::stream::StreamExt;
use llama_cpp_2::{
    llama_backend::LlamaBackend,
    context::params::LlamaContextParams,
    model::params::LlamaModelParams,
    model::{LlamaModel, AddBos},
    llama_batch::LlamaBatch,
    sampling::LlamaSampler,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tower_http::cors::CorsLayer;

#[derive(Debug, Deserialize)]
struct StreamRequest {
    prompt: String,
    session_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct StreamResponse {
    token: String,
    done: bool,
}

struct AppState {
    model: Arc<Mutex<Option<Arc<LlamaModel>>>>,
    model_path: PathBuf,
    backend: Arc<LlamaBackend>,
    sessions: Arc<Mutex<HashMap<String, Vec<llama_cpp_2::token::LlamaToken>>>>,
}

fn log_info(msg: &str) {
    println!("[INFO] {}", msg);
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/blackcode-backend.log") 
    {
        use std::io::Write;
        let _ = writeln!(file, "[{}] [INFO] {}", chrono::Local::now().format("%Y-%m-%d %H:%M:%S"), msg);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let mut model_path = PathBuf::from("models/qwen2.5-coder-7b-instruct.gguf");
    
    for i in 0..args.len() {
        if args[i] == "--model" && i + 1 < args.len() {
            model_path = PathBuf::from(&args[i+1]);
        }
    }

    log_info(&format!("Target Model Path: {:?}", model_path));
    let backend = Arc::new(LlamaBackend::init().context("Inference backend init failed")?);
    
    let state = Arc::new(AppState {
        model: Arc::new(Mutex::new(None)),
        model_path,
        backend,
        sessions: Arc::new(Mutex::new(HashMap::new())),
    });

    let app = Router::new()
        .route("/api/stream", get(stream_handler))
        .route("/api/generate", post(generate_handler))
        .route("/api/ping", get(|| async { "pong" }))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "7777".to_string())
        .parse::<u16>()
        .unwrap_or(7777);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    log_info(&format!("Production server listening on http://{}", addr));

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn generate_handler(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
    Json(req): Json<StreamRequest>,
) -> impl IntoResponse {
    let (tx, mut rx) = mpsc::channel(100);
    let state_clone = state.clone();
    
    tokio::spawn(async move {
        let _ = run_inference_outer(state_clone, req, tx).await;
    });

    let mut full_response = String::new();
    while let Some(resp) = rx.recv().await {
        full_response.push_str(&resp.token);
        if resp.done { break; }
    }
    Json(StreamResponse { token: full_response, done: true })
}

async fn stream_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    log_info(&format!("New client connected"));
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            log_info(&format!("Received message: {}", text.chars().take(50).collect::<String>()));
            let req: StreamRequest = match serde_json::from_str(&text) {
                Ok(r) => r,
                Err(_) => continue,
            };

            let (tx, mut rx) = mpsc::channel(100);
            let state_clone = state.clone();
            
            let tx_err = tx.clone();
            tokio::spawn(async move {
                if let Err(e) = run_inference_outer(state_clone, req, tx).await {
                    let err_msg = format!("\n\n**SYSTEM ERROR**: {}\n\nPlease ensure your GGUF model is placed in the `models/` directory.", e);
                    let _ = tx_err.send(StreamResponse { token: err_msg, done: true }).await;
                }
            });

            while let Some(resp) = rx.recv().await {
                if socket.send(Message::Text(serde_json::to_string(&resp).unwrap())).await.is_err() {
                    break;
                }
            }
        }
    }
}

async fn run_inference_outer(state: Arc<AppState>, req: StreamRequest, tx: mpsc::Sender<StreamResponse>) -> Result<()> {
    log_info(&format!("Starting inference for prompt length: {}", req.prompt.len()));
    let model = get_or_load_model(&state).await?;
    let session_id = req.session_id.clone().unwrap_or_else(|| "default".to_string());
    
    // Get history and release lock
    let mut history = {
        let mut sessions = state.sessions.lock().await;
        sessions.entry(session_id.clone()).or_insert_with(Vec::new).clone()
    };
    
    let backend = state.backend.clone();
    let tx_clone = tx.clone();
    
    // Perform blocking inference
    let new_history = tokio::task::spawn_blocking(move || {
        perform_inference(&model, &backend, req, &mut history, tx_clone)
    }).await.context("Join error")??;

    // Update history
    let mut sessions = state.sessions.lock().await;
    sessions.insert(session_id, new_history);
    
    let _ = tx.send(StreamResponse { token: "".to_string(), done: true }).await;
    log_info(&format!("Inference complete."));
    Ok(())
}

fn perform_inference(
    model: &LlamaModel,
    backend: &LlamaBackend,
    req: StreamRequest,
    history: &mut Vec<llama_cpp_2::token::LlamaToken>,
    tx: mpsc::Sender<StreamResponse>,
) -> Result<Vec<llama_cpp_2::token::LlamaToken>> {
    let new_tokens = model.str_to_token(&req.prompt, AddBos::Never).unwrap_or_default();
    history.extend(new_tokens);

    if history.len() > 6144 { // Increased context limit but added trimming
        let keep = 4096;
        let start = history.len() - keep;
        *history = history[start..].to_vec();
    }

    let threads = std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1) as u32)
        .unwrap_or(4)
        .max(1);

    log_info(&format!("Initializing context with {} threads...", threads));
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(12288)) // Increased context for larger files
        .with_n_threads(threads as i32)
        .with_n_threads_batch((threads * 2) as i32); // Faster ingestion
    let mut ctx = model.new_context(backend, ctx_params).context("Context init failed")?;

    log_info(&format!("Decoding history ({} tokens)...", history.len()));
    let mut batch = LlamaBatch::new(2048, 1);
    for (i, token) in history.iter().enumerate() {
        if batch.n_tokens() >= 2048 {
             ctx.decode(&mut batch).context("Batch decode failed")?;
             batch.clear();
        }
        let _ = batch.add(*token, i as i32, &[0], i == history.len() - 1);
    }

    if batch.n_tokens() > 0 {
        ctx.decode(&mut batch).context("Final history decode failed")?;
    }

    let mut n_cur = history.len() as i32;
    let n_max = 8192;
    let mut sampler = LlamaSampler::greedy();
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    log_info(&format!("Starting token generation..."));
    while n_cur < n_max {
        let token_id = sampler.sample(&ctx, batch.n_tokens() - 1);

        if model.is_eog_token(token_id) { 
            log_info(&format!("End of generation token reached."));
            break; 
        }

        let output = model.token_to_piece(token_id, &mut decoder, true, None).unwrap_or_default();
        
        if output.contains("<|im_end|>") || output.contains("<|im_start|>") {
            log_info(&format!("ChatML stop sequence reached."));
            break;
        }

        if !output.is_empty() {
            print!("{}", output);
            use std::io::Write;
            let _ = std::io::stdout().flush();
            
            if tx.blocking_send(StreamResponse { token: output, done: false }).is_err() {
                log_info(&format!("Client disconnected during generation."));
                return Ok(history.clone());
            }
        }

        history.push(token_id);
        batch.clear();
        let _ = batch.add(token_id, n_cur, &[0], true);
        if ctx.decode(&mut batch).is_err() { 
            log_info(&format!("Decode failed during generation."));
            break; 
        }
        n_cur += 1;
    }

    Ok(history.clone())
}

async fn get_or_load_model(state: &AppState) -> Result<Arc<LlamaModel>> {
    let mut model_lock = state.model.lock().await;
    if let Some(model) = model_lock.as_ref() {
        return Ok(Arc::clone(model));
    }
    
    let mut final_path = None;
    let mut check_paths = vec![
        state.model_path.clone(),
        PathBuf::from("models/qwen2.5-coder-7b-instruct.gguf"),
    ];

    let mut current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for _ in 0..3 {
        check_paths.push(current.join("models/qwen2.5-coder-7b-instruct.gguf"));
        if let Some(parent) = current.parent() {
            current = parent.to_path_buf();
        } else {
            break;
        }
    }
    
    check_paths.push(PathBuf::from("/models/qwen2.5-coder-7b-instruct.gguf"));

    for p in &check_paths {
        if p.exists() {
            log_info(&format!("Found model at: {:?}", p));
            final_path = Some(p.clone());
            break;
        }
    }

    let final_path = final_path.context(format!("GGUF Model not found. Searched in: {:?}", check_paths))?;
    let backend = state.backend.clone();
    
    // Load model in a blocking thread to avoid freezing the async executor
    let model = tokio::task::spawn_blocking(move || {
        let model_params = LlamaModelParams::default()
            .with_n_gpu_layers(100); // Offload ALL layers to GPU if possible
        LlamaModel::load_from_file(&backend, &final_path, &model_params)
    }).await.context("Model loading thread panicked")?.context("Failed to load model file")?;
        
    let shared_model = Arc::new(model);
    *model_lock = Some(Arc::clone(&shared_model));
    Ok(shared_model)
}
