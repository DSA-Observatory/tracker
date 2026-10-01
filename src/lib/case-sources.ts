export type SourceEntry = {
	title: string;
	url: string;
	original?: {
		raw: string;
		title: string;
		url: string;
		legacy: boolean;
	};
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function trimTrailingPunctuation(value: string) {
	let url = value.replace(/[.,;:!?]+$/, '');

	for (const [opening, closing] of [
		['(', ')'],
		['[', ']'],
		['{', '}']
	] as const) {
		while (url.endsWith(closing) && url.split(closing).length - 1 > url.split(opening).length - 1) {
			url = url.slice(0, -1);
		}
	}

	return url;
}

function findUrls(value: string) {
	return Array.from(value.matchAll(URL_PATTERN), (match) => ({
		url: trimTrailingPunctuation(match[0]),
		index: match.index ?? 0,
		matchedLength: match[0].length
	})).filter(({ url }) => url.length > 0);
}

function unchanged(entry: SourceEntry) {
	return (
		entry.original !== undefined &&
		entry.title === entry.original.title &&
		entry.url === entry.original.url
	);
}

function isSafeHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return (
			(url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
		);
	} catch {
		return false;
	}
}

export function parseSources(values?: string[]): SourceEntry[] {
	if (!Array.isArray(values)) return [];

	return values.flatMap<SourceEntry>((raw) => {
		if (typeof raw !== 'string' || !raw.trim()) return [];
		// Our Title + URL format (and standalone URLs) must retain URL punctuation exactly.
		const lines = raw.trim().split('\n');
		const lastLine = lines.at(-1)!.trim();
		if (!/\s/.test(lastLine) && isSafeHttpUrl(lastLine)) {
			const title = lines.slice(0, -1).join('\n').trim();
			return [{ title, url: lastLine, original: { raw, title, url: lastLine, legacy: false } }];
		}

		const urls = findUrls(raw);
		if (urls.length !== 1) {
			return [
				{
					title: raw,
					url: '',
					original: { raw, title: raw, url: '', legacy: true }
				}
			];
		}

		const [{ url, index, matchedLength }] = urls;
		const title = `${raw.slice(0, index)}${raw.slice(index + matchedLength)}`.trim();
		return [
			{
				title,
				url,
				original: { raw, title, url, legacy: false }
			}
		];
	});
}

export function serializeSources(entries: SourceEntry[]): string[] {
	return entries.flatMap((entry) => {
		if (unchanged(entry)) return [entry.original!.raw];

		const title = entry.title.trim();
		const url = entry.url.trim();
		if (!title && !url) return [];
		if (!title || title === url) return [url];
		return [`${title}\n${url}`];
	});
}

export function validateSources(entries: SourceEntry[]): string | null {
	for (const [index, entry] of entries.entries()) {
		const title = entry.title.trim();
		const url = entry.url.trim();
		if (!title && !url) continue;
		if (unchanged(entry)) continue;

		if (!url) return `Source ${index + 1} needs a URL.`;
		if (!isSafeHttpUrl(url)) {
			return `Source ${index + 1} needs a valid http or https URL without credentials.`;
		}
	}

	return null;
}
