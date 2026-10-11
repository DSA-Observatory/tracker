import type { CaseRecord } from '$lib/database';
import type { SheetData } from 'write-excel-file/universal';

const columns = [
	['case_id', 'Case ID', 18],
	['title', 'Case title', 55],
	['jurisdiction', 'Jurisdiction', 22],
	['court', 'Court', 35],
	['filing_date', 'Filing date', 18],
	['decision_date', 'Decision date', 18],
	['decision_reference', 'Decision reference', 28],
	['ecli', 'ECLI', 30],
	['plaintiffs', 'Applicants / plaintiffs', 35],
	['defendants', 'Defendants', 35],
	['categories', 'Categories', 28],
	['dsa_articles', 'DSA provisions', 28],
	['legal_areas', 'Legal areas', 28],
	['legal_basis', 'Legal basis', 28],
	['summary', 'Summary', 70],
	['timeline', 'Procedural timeline', 55],
	['procedural_wording', 'Procedural wording', 45],
	['primary_sources', 'Primary sources', 55],
	['secondary_sources', 'Secondary sources', 55],
	['commentary', 'Commentary', 55],
	['source_limitations', 'Source limitations', 45],
	['status', 'Status', 18],
	['outcome', 'Outcome', 25],
	['url', 'Case link', 50]
] as const;

type ExportKey = (typeof columns)[number][0];
export type CaseExportRow = Record<ExportKey, string>;

export function exportText(value = '') {
	const entities: Record<string, string> = {
		amp: '&',
		lt: '<',
		gt: '>',
		quot: '"',
		apos: "'",
		nbsp: ' '
	};
	return value
		.replace(/<\/(?:p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
			if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
			const code =
				entity[1].toLowerCase() === 'x'
					? parseInt(entity.slice(2), 16)
					: parseInt(entity.slice(1), 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
		})
		.replace(/[^\S\n]+/g, ' ')
		.replace(/\n\s*\n/g, '\n')
		.trim();
}

export function caseExportRows(
	records: CaseRecord[],
	caseUrl: (id: string) => string
): CaseExportRow[] {
	const list = (values?: string[]) => (values ?? []).map(exportText).join('; ');
	return records.map((record) => ({
		case_id: record.case_id,
		title: record.title,
		jurisdiction: record.jurisdiction ?? '',
		court: record.court ?? '',
		filing_date: record.filing_date?.slice(0, 10) ?? '',
		decision_date: record.decision_date?.slice(0, 10) ?? '',
		decision_reference: record.decision_reference ?? '',
		ecli: record.ecli ?? '',
		plaintiffs: list(record.plaintiffs),
		defendants: list(record.defendants),
		categories: list(record.categories),
		dsa_articles: list(record.dsa_articles),
		legal_areas: list(record.legal_areas),
		legal_basis: list(record.legal_basis),
		summary: exportText(record.summary),
		timeline: record.procedural_events?.length
			? record.procedural_events
					.map((event) =>
						[event.date?.slice(0, 10), event.label, exportText(event.description)]
							.filter(Boolean)
							.join(' — ')
					)
					.join('\n')
			: exportText(record.timeline),
		procedural_wording: record.procedural_wording ?? '',
		primary_sources: list(record.primary_sources),
		secondary_sources: list(record.secondary_sources),
		commentary: exportText(record.commentary),
		source_limitations: exportText(record.source_limitations),
		status: record.status,
		outcome: record.outcome ?? '',
		url: caseUrl(record.id)
	}));
}

export function caseExportCsv(rows: CaseExportRow[]) {
	const cell = (value: string) => {
		// CSV programs can interpret even quoted values as executable formulas.
		// eslint-disable-next-line no-control-regex -- Control prefixes can hide spreadsheet formulas.
		const safe = /^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
		return `"${safe.replace(/"/g, '""')}"`;
	};
	return (
		'\ufeff' +
		[
			columns.map(([, label]) => cell(label)).join(','),
			...rows.map((row) => columns.map(([key]) => cell(row[key])).join(','))
		].join('\r\n')
	);
}

export function caseExportSheet(rows: CaseExportRow[]): SheetData {
	return [
		columns.map(([, label]) => ({
			value: label,
			type: String,
			fontWeight: 'bold',
			color: '#FFFFFF',
			backgroundColor: '#0F172A',
			wrap: true
		})),
		...rows.map((row) =>
			columns.map(([key]) => ({
				value: row[key],
				type: String,
				wrap: true,
				alignVertical: 'top' as const
			}))
		)
	];
}

export async function caseExportExcel(rows: CaseExportRow[]) {
	const { default: writeXlsxFile } = await import('write-excel-file/universal');
	return writeXlsxFile(
		caseExportSheet(rows),
		{
			sheet: 'Cases',
			columns: columns.map(([, , width]) => ({ width })),
			stickyRowsCount: 1
		},
		{ fontFamily: 'Arial', fontSize: 11 }
	).toBlob();
}
