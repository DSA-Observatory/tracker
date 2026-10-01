import { describe, expect, test } from 'bun:test';
import { parseSources, serializeSources, validateSources } from '../src/lib/case-sources';
import { readFile } from 'node:fs/promises';

describe('case sources', () => {
	test('preserves unchanged imported sources exactly', () => {
		const sources = [
			'https://court.example/decision?id=1&lang=en',
			'Judgment\nhttps://court.example/decision',
			'  Commentary https://journal.example/article.  ',
			'Legacy title without a link',
			'Two sources https://one.example/a and https://two.example/b'
		];
		expect(serializeSources(parseSources(sources))).toEqual(sources);
		expect(validateSources(parseSources(sources))).toBe(null);
	});

	test('edits and reloads a clickable title without splitting it from its URL', () => {
		const entries = parseSources(['https://court.example/decision']);
		entries[0].title = 'Court judgment';
		expect(serializeSources(entries)).toEqual(['Court judgment\nhttps://court.example/decision']);
		const reloaded = parseSources(serializeSources(entries));
		expect(reloaded[0].title).toBe('Court judgment');
		expect(reloaded[0].url).toBe('https://court.example/decision');
	});

	test('keeps valid URL punctuation in new and canonical sources', () => {
		for (const url of [
			'https://example.com/a(b)',
			'https://example.com/a?',
			'https://example.com/a!',
			'https://example.com/?q=one&next=two'
		]) {
			for (const title of ['', 'Decision']) {
				const entries = [{ title, url }];
				expect(parseSources(serializeSources(entries))[0].url).toBe(url);
			}
		}
	});

	test('blank rows are ignored; edited text-only sources need evidence', () => {
		expect(serializeSources([{ title: ' ', url: '' }])).toEqual([]);
		expect(validateSources([{ title: ' ', url: '' }])).toBe(null);
		const entries = parseSources(['Legacy reference']);
		entries[0].title = 'Edited reference';
		expect(validateSources(entries)).toContain('needs a URL');
	});

	test('rejects unsafe schemes, malformed URLs and embedded credentials', () => {
		for (const url of [
			'javascript:alert(1)',
			'data:text/html,<script>',
			'//example.com',
			'not a URL',
			'https://name:password@example.com'
		]) {
			expect(validateSources([{ title: 'Source', url }])).toContain('valid http or https');
		}
		for (const url of ['http://court.example/decision', 'https://court.example/decision']) {
			expect(validateSources([{ title: '', url }])).toBe(null);
		}
	});

	test('removing one source leaves other legacy content intact', () => {
		const entries = parseSources(['Old title', 'https://court.example/decision']);
		expect(serializeSources(entries.slice(1))).toEqual(['https://court.example/decision']);
	});
});

test('case editing omits historical themes and uses source validation and the date field', async () => {
	const editor = await readFile(
		new URL('../src/lib/components/cases/CaseEditorForm.svelte', import.meta.url),
		'utf8'
	);
	expect(editor.includes('themes:')).toBe(false);
	expect(editor.includes('form.themes')).toBe(false);
	expect(editor).toContain('validateSources(primarySources)');
	expect(editor).toContain('primary_sources: serializeSources(primarySources)');
	expect(editor).toContain('secondary_sources: serializeSources(secondarySources)');
	expect(editor).toContain('Judgment/decision date');
	const filters = await readFile(
		new URL('../src/lib/components/cases/CaseFilterPanel.svelte', import.meta.url),
		'utf8'
	);
	expect(filters.includes('themes')).toBe(false);
	const display = await readFile(
		new URL('../src/lib/components/cases/CaseSourceList.svelte', import.meta.url),
		'utf8'
	);
	expect(display).toContain('safeHref(entry.url)');
	expect(display.includes('{@html')).toBe(false);
});
