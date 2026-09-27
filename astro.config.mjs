import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function rehypeLatexDelimiters() {
	return function transformLatexDelimiters(tree) {
		function visit(node) {
			if (!node || !Array.isArray(node.children)) {
				return;
			}

			if (node.type === 'element' && node.tagName === 'p') {
				const text = node.children
					.filter((child) => child.type === 'text')
					.map((child) => child.value)
					.join('')
					.trim();
				const isMath = /(?:\\[a-zA-Z]+|[_^=])/.test(text);

				const displayMatch = text.match(/^\\\[([\s\S]*?)\\\]$/) ||
					(text.startsWith('[') && text.endsWith(']') ? [text, text.slice(1, -1)] : null);

				if (displayMatch && isMath) {
					node.tagName = 'pre';
					node.properties = {};
					node.children = [{
						type: 'element',
						tagName: 'code',
						properties: { className: ['language-math', 'math-display'] },
						children: [{ type: 'text', value: displayMatch[1].trim() }],
					}];
					return;
				}

				const children = [];
				for (const child of node.children) {
					if (child.type !== 'text') {
						children.push(child);
						continue;
					}

					let lastIndex = 0;
					const pattern = /\\\(([\s\S]*?)\\\)/g;
					let match;

					while ((match = pattern.exec(child.value))) {
						if (match.index > lastIndex) {
							children.push({ type: 'text', value: child.value.slice(lastIndex, match.index) });
						}
						children.push({ type: 'element', tagName: 'code', properties: { className: ['language-math', 'math-inline'] }, children: [{ type: 'text', value: match[1] }] });
						lastIndex = match.index + match[0].length;
					}

					if (lastIndex < child.value.length) {
						children.push({ type: 'text', value: child.value.slice(lastIndex) });
					}
				}
				node.children = children;
			}

			for (const child of node.children ?? []) {
				visit(child);
			}
		}

		visit(tree);
	};
}

export default defineConfig({
	site: 'https://tsy20031016.github.io',
	base: '/eccentric-eclipse',
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [rehypeLatexDelimiters, rehypeKatex],
		}),
		shikiConfig: {
			theme: 'github-light',
		},
	},
});
