import MarkdownIt from 'markdown-it';
import { setupKatex } from './katexSetup';
import { setupHighlighting } from './codeHighlight';
import DOMPurify from 'dompurify';

export class MarkdownRenderer {
    private md: MarkdownIt;

    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true
        });

        setupKatex(this.md);
        setupHighlighting(this.md);
    }

    public render(text: string): string {
        const rawHtml = this.md.render(text);
        // Sanitize to prevent XSS
        return DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ['math', 'annotation', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'mfrac', 'msup', 'msub', 'msqrt'],
            ADD_ATTR: ['display', 'xmlns', 'encoding']
        });
    }
}
