import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders basic markdown', () => {
		const html = renderMarkdown('# Title\n\n**bold** and *italic* and [link](https://example.com)');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<em>italic</em>');
		expect(html).toContain('href="https://example.com"');
	});

	it('demotes headings one level so a proposal never emits a second page <h1>', () => {
		const html = renderMarkdown('# One\n\n## Two\n\n###### Six');
		expect(html).not.toContain('<h1');
		expect(html).toContain('<h2>One</h2>');
		expect(html).toContain('<h3>Two</h3>');
		// h6 is already the floor — it stays h6.
		expect(html).toContain('<h6>Six</h6>');
	});

	it('renders tables and images', () => {
		const html = renderMarkdown(
			'| a | b |\n|---|---|\n| 1 | 2 |\n\n![alt](https://img.example/x.png)'
		);
		expect(html).toContain('<table');
		expect(html).toContain('<td');
		expect(html).toContain('<img');
		expect(html).toContain('src="https://img.example/x.png"');
	});

	it('strips <script> tags', () => {
		const html = renderMarkdown('hi <script>alert(1)</script> there');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('alert(1)');
	});

	it('strips event-handler attributes', () => {
		const html = renderMarkdown('<img src="x" onerror="alert(1)">');
		expect(html).not.toContain('onerror');
	});

	it('blocks javascript: links', () => {
		const html = renderMarkdown('[click](javascript:alert(1))');
		expect(html).not.toContain('javascript:');
	});

	it('hardens external links with rel/target', () => {
		const html = renderMarkdown('[x](https://example.com)');
		expect(html).toContain('rel="noopener nofollow ugc"');
		expect(html).toContain('target="_blank"');
	});

	it('returns empty string for null/empty input', () => {
		expect(renderMarkdown(null)).toBe('');
		expect(renderMarkdown('')).toBe('');
	});
});
