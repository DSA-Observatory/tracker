import { describe, expect, test } from 'bun:test';
import {
	caseExportCsv,
	caseExportExcel,
	caseExportRows,
	caseExportSheet,
	exportText
} from '../src/lib/case-export';
import type { CaseRecord } from '../src/lib/database/client';

const record: CaseRecord = {
	id: 'case123',
	case_id: 'DSA-01',
	title: 'Müller, "Applicant" v Defendant',
	status: 'decided',
	published: true,
	created: '',
	updated: '',
	decision_date: '2026-10-07 00:00:00.000Z',
	summary: '<p>First &amp; second</p><p>Caf&#233; &#x2014; DSA</p>',
	plaintiffs: ['Alice', 'Bob'],
	defendants: ['Example'],
	primary_sources: ['Decision https://example.com/decision'],
	editorial_notes: 'Private editorial note',
	workbook_source: { private: 'metadata' }
};
const url = (id: string) => `https://example.com/cases/${id}`;

describe('case export', () => {
	test('exports only supplied selection and omits private metadata', () => {
		const rows = caseExportRows([record], url);
		expect(rows).toHaveLength(1);
		expect(rows[0].summary).toBe('First & second\nCafé — DSA');
		expect(rows[0].decision_date).toBe('2026-10-07');
		expect(rows[0].plaintiffs).toBe('Alice; Bob');
		expect(rows[0].url).toBe(url(record.id));
		expect(JSON.stringify(rows)).not.toContain('Private editorial note');
		expect('workbook_source' in rows[0]).toBe(false);
		expect(caseExportRows([], url)).toEqual([]);
	});
	test('CSV has readable headers, UTF-8 BOM, quoted multiline text and escaped quotes', () => {
		const csv = caseExportCsv(caseExportRows([record], url));
		expect(csv.startsWith('\ufeff"Case ID","Case title"')).toBe(true);
		expect(csv).toContain('"Müller, ""Applicant"" v Defendant"');
		expect(csv).toContain('"First & second\nCafé — DSA"');
		expect(caseExportCsv([])).toContain('Case title');
	});
	test('CSV neutralizes spreadsheet formulas including leading whitespace', () => {
		for (const title of [
			'=HYPERLINK("https://bad.example")',
			'+SUM(1)',
			'-1+1',
			'@SUM(1)',
			' \t=1',
			'\tunsafe'
		]) {
			const csv = caseExportCsv(caseExportRows([{ ...record, title }], url));
			expect(csv).toContain(`"'${title.replace(/"/g, '""')}"`);
		}
	});
	test('Excel writes source strings as text, never formulas', async () => {
		const rows = caseExportRows([{ ...record, title: '=SUM(1,2)' }], url);
		const sheet = caseExportSheet(rows);
		expect(sheet[1][1]).toEqual({
			value: '=SUM(1,2)',
			type: String,
			wrap: true,
			alignVertical: 'top'
		});
		const blob = await caseExportExcel(rows);
		expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 2)]).toEqual([80, 75]);
	});
	test('HTML entities are decoded once and invalid code points are safe', () => {
		expect(exportText('&lt;em&gt;text&lt;/em&gt;')).toBe('<em>text</em>');
		expect(exportText('&#999999999999;')).toBe('');
	});
});
