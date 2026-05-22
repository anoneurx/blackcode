import { MarkdownRenderer } from './markdownRenderer';
import { applyCopyButtons } from './codeHighlight';

export class StreamingRenderer {
    private renderer: MarkdownRenderer;
    private container: HTMLElement;
    private buffer: string = "";
    private lastRenderedHtml: string = "";

    constructor(container: HTMLElement) {
        this.renderer = new MarkdownRenderer();
        this.container = container;
    }

    public update(token: string) {
        this.buffer += token;
        const html = this.renderer.render(this.buffer);
        
        // Only update if the content actually changed to avoid flickering
        if (html !== this.lastRenderedHtml) {
            this.container.innerHTML = html;
            this.lastRenderedHtml = html;
            applyCopyButtons(this.container);
            this.scrollToBottom();
        }
    }

    public finish() {
        applyCopyButtons(this.container);
        this.scrollToBottom();
    }

    private scrollToBottom() {
        const chatList = document.getElementById('chatList');
        if (chatList) {
            chatList.scrollTop = chatList.scrollHeight;
        }
    }
}
