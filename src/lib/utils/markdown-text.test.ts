import { describe, it, expect } from 'vitest';
import { markdownToPlainText } from './markdown-text';

describe('markdownToPlainText', () => {
	it('strips headings, emphasis, links and table syntax into readable text', () => {
		const md =
			'# Test\n## Test 2\nWe are testing a **lot**! This is *important*! Go to [google](https://google.com).\n\n| Col 1 | Col 2 |\n| --- | --- |\n| column 1 | column 2 |\n\n---';
		const text = markdownToPlainText(md);
		expect(text).not.toMatch(/[#*|]/);
		expect(text).not.toContain('https://google.com');
		expect(text).toContain('We are testing a lot!');
		expect(text).toContain('Go to google.');
		expect(text).toContain('Col 1');
		expect(text).toContain('column 2');
	});

	it('keeps image alt text and inline code content', () => {
		expect(markdownToPlainText('See ![a diagram](x.png) and `run()`.')).toBe(
			'See a diagram and run().'
		);
	});

	it('returns empty string for nullish input', () => {
		expect(markdownToPlainText(null)).toBe('');
		expect(markdownToPlainText(undefined)).toBe('');
		expect(markdownToPlainText('')).toBe('');
	});
});
