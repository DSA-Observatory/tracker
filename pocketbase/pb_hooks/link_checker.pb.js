/// <reference path="../pb_data/types.d.ts" />

const schedule = $os.getenv('LINK_CHECK_CRON') || '0 3 * * *';

globalThis.linkCheckRunning = false;

cronAdd('check-broken-links', schedule, () => {
	if (($os.getenv('LINK_CHECK_ENABLED') || 'true') !== 'true') return;
	if (globalThis.linkCheckRunning) return;

	globalThis.linkCheckRunning = true;

	const fields = [
		'document_links',
		'summary',
		'timeline',
		'commentary',
		'primary_sources',
		'secondary_sources'
	];

	const normalizeUrl = (url) =>
		String(url || '')
			.replace(/&amp;/g, '&')
			.replace(/[\s.,;:)\]]+$/, '');

	const extractUrls = (value) => {
		const urls = [];
		const text = typeof value === 'string' ? value : JSON.stringify(value || '');
		const matches = text.match(/https?:\/\/[^\s<")]+/g) || [];

		for (const match of matches) {
			const url = normalizeUrl(match);
			if (url) urls.push(url);
		}

		return urls;
	};

	const caseLinks = (record) => {
		const seen = {};
		const links = [];

		for (const field of fields) {
			for (const url of extractUrls(record.get(field))) {
				const key = `${field}\n${url.toLowerCase()}`;
				if (seen[key]) continue;

				seen[key] = true;
				links.push({ field, url });
			}
		}

		return links;
	};

	const requestUrl = (method, url) =>
		$http.send({
			method,
			url,
			timeout: parseInt($os.getenv('LINK_CHECK_TIMEOUT_SECONDS') || '15', 10),
			headers: { 'User-Agent': 'DSA Case Law Tracker link checker' }
		});

	const checkUrl = (url) => {
		try {
			let res = requestUrl('HEAD', url);

			if ([403, 405, 501].includes(res.statusCode)) {
				res = requestUrl('GET', url);
			}

			return {
				statusCode: String(res.statusCode),
				ok: res.statusCode >= 200 && res.statusCode < 400,
				error: ''
			};
		} catch (e) {
			return {
				statusCode: '',
				ok: false,
				error: String(e && e.message ? e.message : e).slice(0, 500)
			};
		}
	};

	const saveLinkCheck = (collection, runId, checkedAt, record, link, result) => {
		const check = new Record(collection);

		check.set('run_id', runId);
		check.set('case_record_id', record.id);
		check.set('case_id', record.getString('case_id'));
		check.set('case_title', record.getString('title'));
		check.set('source_field', link.field);
		check.set('url', link.url);
		check.set('status_code', result.statusCode);
		check.set('ok', result.ok);
		check.set('error', result.error);
		check.set('checked_at', checkedAt);

		$app.save(check);
	};

	try {
		const collection = $app.findCollectionByNameOrId('link_checks');
		const records = $app.findRecordsByFilter('cases', 'published = true', 'case_id', 0, 0);
		const runId = new Date()
			.toISOString()
			.replace(/[-:.TZ]/g, '')
			.slice(0, 14);
		const checkedAt = new Date().toISOString();
		let checked = 0;
		let broken = 0;

		for (const record of records) {
			for (const link of caseLinks(record)) {
				const result = checkUrl(link.url);
				checked += 1;
				if (!result.ok) broken += 1;

				saveLinkCheck(collection, runId, checkedAt, record, link, result);
			}
		}

		console.log(`Link check complete: checked=${checked}, broken=${broken}, run=${runId}`);
	} catch (e) {
		console.error('Link check failed:', e);
	} finally {
		globalThis.linkCheckRunning = false;
	}
});

console.log(`Link checker scheduled: ${schedule}`);
