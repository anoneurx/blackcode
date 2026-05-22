import { StreamingRenderer } from '../renderer/streamingRenderer';
import './style.css'; // This will bundle the base styles

// Only export the renderer so the inlined script in index.html can use it
(window as any).BlackCodeRenderer = StreamingRenderer;

console.log("Black Code Heavy Dependencies Loaded.");
