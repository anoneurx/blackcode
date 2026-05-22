import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

export function setupHighlighting(md: any) {
    md.set({
        highlight: function (str: string, lang: string) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return '<pre class="hljs"><code>' +
                        hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                        '</code></pre>';
                } catch (__) { }
            }

            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        }
    });
}

export function applyCopyButtons(container: HTMLElement) {
    const blocks = container.querySelectorAll('pre.hljs');
    blocks.forEach((block) => {
        if (block.parentElement?.querySelector('.code-block-header')) return;

        const code = block.querySelector('code')?.innerText || '';
        const lang = block.querySelector('code')?.className.replace('language-', '') || 'code';

        const createButton = (icon: string, title: string, onClick: (btn: HTMLButtonElement) => void) => {
            const btn = document.createElement('button');
            btn.className = 'code-action-btn';
            btn.innerHTML = icon;
            btn.title = title;
            btn.onclick = () => onClick(btn);
            return btn;
        };

        const copyBtn = createButton(
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            'Copy code',
            (btn) => {
                navigator.clipboard.writeText(code);
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }, 2000);
            }
        );

        const applyBtn = createButton(
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="10" y1="14" x2="21" y2="3"></line><polyline points="9 21 4 21 4 16"></polyline><line x1="14" y1="10" x2="4" y2="21"></line></svg>',
            'Apply to selection',
            () => {
                (window as any).vscode?.postMessage({ type: 'applyCode', value: code });
            }
        );

        const saveBtn = createButton(
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
            'Save as new file',
            () => {
                const fileName = prompt("Enter file name (e.g., src/index.ts):", `new_file.${lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang}`);
                if (fileName) {
                    (window as any).vscode?.postMessage({ type: 'createFile', path: fileName, content: code });
                }
            }
        );

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `<span>${lang}</span>`;
        
        const actions = document.createElement('div');
        actions.className = 'code-block-actions';
        actions.appendChild(applyBtn);
        actions.appendChild(saveBtn);
        actions.appendChild(copyBtn);
        
        header.appendChild(actions);
        block.parentElement?.insertBefore(header, block);
    });
}

