import mdKatex from 'markdown-it-katex';
import 'katex/dist/katex.min.css';

export function setupKatex(md: any) {
    md.use(mdKatex, {
        throwOnError: false,
        errorColor: ' #cc0000'
    });
}
