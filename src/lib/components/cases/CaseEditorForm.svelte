<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, pb, type CaseRecord, type CaseStatus } from '$lib/database';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconDownload from '~icons/lucide/download';
	import IconFileText from '~icons/lucide/file-text';
	import IconUpload from '~icons/lucide/upload';
	import IconX from '~icons/lucide/x';
	import CaseSummaryEditor from './CaseSummaryEditor.svelte';
	import {
		emptyCaseForm,
		joinCaseFormList,
		joinCaseFormLines,
		splitCaseFormList,
		splitCaseFormLines,
		statusOptions,
		type CaseForm
	} from './types';

	let { caseId }: { caseId?: string } = $props();

	let loading = $state(Boolean(caseId));
	let saving = $state(false);
	let error = $state('');
	let attemptedSubmit = $state(false);
	let form = $state<CaseForm>(emptyCaseForm());
	let currentRecord = $state<CaseRecord>();
	let existingDocuments = $state<string[]>([]);
	let selectedDocuments = $state<File[]>([]);
	let documentInput = $state<HTMLInputElement>();
	let csvInput = $state<HTMLInputElement>();
	let importingCsv = $state(false);
	let importMessage = $state('');

	const csvColumns = [
		'case_id',
		'title',
		'status',
		'outcome',
		'jurisdiction',
		'court',
		'courts',
		'decision_date',
		'ecli',
		'plaintiffs',
		'defendants',
		'dsa_articles',
		'legal_areas',
		'legal_basis',
		'case_scope',
		'categories',
		'themes',
		'keywords',
		'primary_sources',
		'secondary_sources',
		'source_limitations',
		'editorial_notes',
		'summary',
		'timeline'
	] satisfies (keyof CaseForm)[];

	const canWrite = $derived(authStore.isAuthenticated && pb.authStore.isValid);
	const isEditing = $derived(Boolean(caseId));

	$effect(() => {
		if (caseId) loadCase(caseId);
	});

	async function loadCase(id: string) {
		loading = true;
		error = '';

		try {
			const record = await pb.collection('cases').getOne<CaseRecord>(id);
			currentRecord = record;
			existingDocuments = record.documents ?? [];
			form = {
				case_id: record.case_id,
				title: record.title,
				ecli: record.ecli ?? '',
				decision_date: record.decision_date ? record.decision_date.slice(0, 10) : '',
				status: record.status,
				court: record.court ?? '',
				jurisdiction: record.jurisdiction ?? '',
				plaintiffs: joinCaseFormList(record.plaintiffs),
				defendants: joinCaseFormList(record.defendants),
				outcome: record.outcome ?? '',
				courts: joinCaseFormList(record.courts),
				legal_areas: joinCaseFormList(record.legal_areas),
				legal_basis: joinCaseFormList(record.legal_basis),
				case_scope: record.case_scope ?? 'private enforcement',
				procedural_events:
					record.procedural_events
						?.map((event) =>
							[event.date, event.label, event.description].filter(Boolean).join(' | ')
						)
						.join('\n') ?? '',
				summary: record.summary ?? '',
				timeline: record.timeline ?? '',
				categories: joinCaseFormList(record.categories),
				themes: joinCaseFormList(record.themes),
				primary_sources: joinCaseFormLines(record.primary_sources),
				secondary_sources: joinCaseFormLines(record.secondary_sources),
				source_limitations: record.source_limitations ?? '',
				editorial_notes: record.editorial_notes ?? '',
				keywords: joinCaseFormList(record.keywords),
				dsa_articles: joinCaseFormList(record.dsa_articles),
				published: record.published
			};
		} catch (err) {
			console.error('Error loading case:', err);
			error = 'Could not load this case. Check PocketBase availability and permissions.';
		} finally {
			loading = false;
		}
	}

	function documentUrl(filename: string) {
		return currentRecord ? pb.files.getURL(currentRecord, filename) : '#';
	}

	function selectDocuments(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		selectedDocuments = [...selectedDocuments, ...Array.from(input.files ?? [])];
		input.value = '';
	}

	function removeSelectedDocument(index: number) {
		selectedDocuments = selectedDocuments.filter((_, fileIndex) => fileIndex !== index);
		if (documentInput) documentInput.value = '';
	}

	function formatFileSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	function appendPayload(target: FormData, payload: Record<string, unknown>) {
		for (const [key, value] of Object.entries(payload)) {
			if (value == null) target.append(key, '');
			else target.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
		}
	}

	async function importCsv(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || isEditing || importingCsv) return;
		if (!canWrite) {
			error = 'Your session expired. Log in again before importing CSV.';
			input.value = '';
			return;
		}

		importingCsv = true;
		importMessage = '';
		error = '';

		try {
			const rows = parseCsv(await file.text());
			const existing = await pb.collection('cases').getFullList<CaseRecord>({ fields: 'case_id' });
			const existingCaseIds = existing.map((record) => record.case_id.trim().toLowerCase());
			let imported = 0;
			let skipped = 0;

			for (const [index, row] of rows.entries()) {
				const caseId = row.case_id?.trim();
				const title = row.title?.trim();
				if (!caseId || !title || existingCaseIds.includes(caseId.toLowerCase())) {
					skipped += 1;
					continue;
				}

				try {
					await pb.collection('cases').create<CaseRecord>(csvRowToCase(row));
					existingCaseIds.push(caseId.toLowerCase());
					imported += 1;
				} catch (err) {
					if (isDuplicateCaseIdError(err)) {
						skipped += 1;
						continue;
					}

					throw new Error(`Row ${index + 2} (${caseId}): ${importErrorDetails(err)}`);
				}
			}

			importMessage = `Imported ${imported} case${imported === 1 ? '' : 's'}${skipped ? `; skipped ${skipped}` : ''}.`;
		} catch (err) {
			console.error('Error importing CSV:', err);
			error = importErrorMessage(err);
		} finally {
			input.value = '';
			importingCsv = false;
		}
	}

	function importErrorMessage(err: unknown) {
		if (err instanceof Error) return `Could not import CSV. ${err.message}`;

		const details = importErrorDetails(err);
		return details
			? `Could not import CSV. ${details}`
			: 'Could not import CSV. Check the columns and your permissions.';
	}

	function importErrorDetails(err: unknown) {
		const response = err as {
			data?: { data?: Record<string, { message?: string }>; message?: string };
			response?: { data?: Record<string, { message?: string }>; message?: string };
			message?: string;
		};
		const data = response.data?.data ?? response.response?.data;
		const details = data
			? Object.entries(data)
					.map(([field, issue]) => `${field}: ${issue.message ?? 'invalid value'}`)
					.join('; ')
			: '';

		return (
			details || response.data?.message || response.response?.message || response.message || ''
		);
	}

	function isDuplicateCaseIdError(err: unknown) {
		const details = importErrorDetails(err).toLowerCase();
		return details.includes('case_id') && (details.includes('unique') || details.includes('exist'));
	}

	function saveErrorMessage(err: unknown) {
		const details = importErrorDetails(err);
		return details
			? `Could not save the case. ${details}`
			: 'Could not save the case. Check required fields and permissions.';
	}

	function missingRequiredFields() {
		return [
			{ label: 'Case ID', missing: !form.case_id.trim() },
			{ label: 'Case title', missing: !form.title.trim() }
		]
			.filter((field) => field.missing)
			.map((field) => field.label);
	}

	function clearRequiredError() {
		if (error.startsWith('Fill required fields')) error = '';
	}

	function parseCsv(text: string) {
		const rows: string[][] = [];
		let row: string[] = [];
		let cell = '';
		let quoted = false;

		for (let index = 0; index < text.length; index += 1) {
			const char = text[index];
			const next = text[index + 1];

			if (char === '"') {
				if (quoted && next === '"') {
					cell += '"';
					index += 1;
				} else {
					quoted = !quoted;
				}
			} else if (char === ',' && !quoted) {
				row.push(cell);
				cell = '';
			} else if ((char === '\n' || char === '\r') && !quoted) {
				if (char === '\r' && next === '\n') index += 1;
				row.push(cell);
				if (row.some((value) => value.trim())) rows.push(row);
				row = [];
				cell = '';
			} else {
				cell += char;
			}
		}

		row.push(cell);
		if (row.some((value) => value.trim())) rows.push(row);

		const headers = rows.shift()?.map((header) => header.trim().replace(/^\uFEFF/, '')) ?? [];
		return rows.map((values) =>
			Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
		);
	}

	function csvRowToCase(row: Record<string, string>) {
		const status = statusOptions.includes(row.status as CaseStatus)
			? (row.status as CaseStatus)
			: 'draft';
		const payload: Record<string, unknown> = {
			case_id: row.case_id.trim(),
			title: row.title.trim(),
			status
		};

		for (const field of csvColumns) {
			const value = row[field]?.trim() ?? '';
			if (!value || field === 'case_id' || field === 'title' || field === 'status') continue;
			if (field === 'primary_sources' || field === 'secondary_sources') {
				payload[field] = splitCaseFormLines(value);
			} else if (isCsvListField(field)) {
				payload[field] = splitCsvList(value);
			} else {
				payload[field] = value;
			}
		}

		return payload;
	}

	function isCsvListField(field: keyof CaseForm) {
		return [
			'courts',
			'plaintiffs',
			'defendants',
			'dsa_articles',
			'legal_areas',
			'legal_basis',
			'categories',
			'themes',
			'keywords'
		].includes(field);
	}

	function splitCsvList(value: string) {
		return value.includes(';')
			? value
					.split(';')
					.map((item) => item.trim())
					.filter(Boolean)
			: splitCaseFormList(value);
	}

	function downloadCsvTemplate() {
		const sample = Object.fromEntries(csvColumns.map((column) => [column, '']));
		sample.case_id = 'DSA-EXAMPLE-001';
		sample.title = 'Example platform enforcement case';
		sample.status = 'draft';
		sample.jurisdiction = 'France';
		sample.plaintiffs = 'Plaintiff A; Plaintiff B';
		sample.defendants = 'Platform Inc.';
		sample.dsa_articles = 'Article 14; Article 17';

		downloadBlob(
			'dsa-cases-import-template.csv',
			new Blob([toCsv([sample])], { type: 'text/csv;charset=utf-8' })
		);
	}

	function downloadBlob(filename: string, blob: Blob) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	function toCsv(rows: Record<string, string>[]) {
		if (!rows.length) return '';
		const headers = Object.keys(rows[0]);
		return [
			headers.join(','),
			...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
		].join('\n');
	}

	function csvCell(value: string) {
		return `"${value.replace(/"/g, '""')}"`;
	}

	async function saveCase() {
		attemptedSubmit = true;
		const missingFields = missingRequiredFields();
		if (missingFields.length) {
			error = `Fill required fields: ${missingFields.join(', ')}.`;
			return;
		}
		if (!canWrite) {
			error = 'Your session expired. Log in again before saving cases.';
			return;
		}

		saving = true;
		error = '';

		const payload = {
			case_id: form.case_id.trim(),
			title: form.title.trim(),
			ecli: form.ecli.trim(),
			decision_date: form.decision_date || null,
			status: form.status,
			court: form.court.trim(),
			jurisdiction: form.jurisdiction.trim(),
			plaintiffs: splitCaseFormList(form.plaintiffs),
			defendants: splitCaseFormList(form.defendants),
			outcome: form.outcome.trim(),
			courts: splitCaseFormList(form.courts),
			legal_areas: splitCaseFormList(form.legal_areas),
			legal_basis: splitCaseFormList(form.legal_basis),
			case_scope: form.case_scope.trim(),
			procedural_events: splitCaseFormLines(form.procedural_events).map((line) => {
				const [date, label, description] = line.split('|').map((part) => part.trim());
				return { date, label, description };
			}),
			summary: form.summary.trim(),
			timeline: form.timeline.trim(),
			categories: splitCaseFormList(form.categories),
			themes: splitCaseFormList(form.themes),
			primary_sources: splitCaseFormLines(form.primary_sources),
			secondary_sources: splitCaseFormLines(form.secondary_sources),
			source_limitations: form.source_limitations.trim(),
			editorial_notes: form.editorial_notes.trim(),
			keywords: splitCaseFormList(form.keywords),
			dsa_articles: splitCaseFormList(form.dsa_articles),
			published: form.published || form.status === 'published'
		};

		try {
			if (caseId) {
				if (selectedDocuments.length) {
					const body = new FormData();
					appendPayload(body, payload);
					selectedDocuments.forEach((file) => body.append('documents+', file));
					await pb.collection('cases').update<CaseRecord>(caseId, body);
				} else {
					await pb.collection('cases').update<CaseRecord>(caseId, payload);
				}
			} else {
				if (selectedDocuments.length) {
					const body = new FormData();
					appendPayload(body, payload);
					selectedDocuments.forEach((file) => body.append('documents', file));
					await pb.collection('cases').create<CaseRecord>(body);
				} else {
					await pb.collection('cases').create<CaseRecord>(payload);
				}
			}

			await goto(resolve('/cases'));
		} catch (err) {
			console.error('Error saving case:', err);
			error = saveErrorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<section class="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
	{#if !isEditing}
		<input
			bind:this={csvInput}
			class="hidden"
			type="file"
			accept=".csv,text/csv"
			onchange={importCsv}
		/>
	{/if}
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xs font-semibold tracking-[0.2em] text-base-content/50 uppercase">
				Case editor
			</p>
			<h1 class="text-3xl font-black">{isEditing ? 'Edit case' : 'Create case'}</h1>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if canWrite && !isEditing}
				<button class="btn gap-2 btn-outline btn-sm" type="button" onclick={downloadCsvTemplate}
					><IconDownload class="size-4" /> Download CSV template</button
				>
				<button
					class="btn gap-2 btn-outline btn-sm"
					type="button"
					disabled={importingCsv}
					onclick={() => csvInput?.click()}
					><IconUpload class="size-4" />{importingCsv ? 'Importing' : 'Import CSV'}</button
				>
			{/if}
			<button class="btn gap-2 btn-ghost" type="button" onclick={() => goto(resolve('/cases'))}
				><IconArrowLeft class="size-4" /> Back to cases</button
			>
		</div>
	</div>

	{#if importMessage}
		<p
			class="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
		>
			{importMessage}
		</p>
	{/if}

	{#if !canWrite}
		<div class="alert alert-warning">Log in with editor privileges to create or edit cases.</div>
	{:else if loading}
		<div class="border border-base-300 bg-base-100 p-6 shadow-sm">Loading case...</div>
	{:else}
		<form
			class="case-editor-form border border-base-300 bg-base-200/60 p-4 shadow-sm"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				saveCase();
			}}
		>
			{#if error}
				<div class="mb-4 alert alert-error">{error}</div>
			{/if}

			<div
				class="mb-4 rounded-lg border border-base-300 bg-base-100 p-3 text-sm text-base-content/70 shadow-sm"
			>
				Fill the essentials first. Open the sections below only when that metadata is relevant.
			</div>

			<div class="space-y-3">
				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm" open>
					<summary class="cursor-pointer text-base font-bold">
						Essentials
						<span class="ml-2 text-sm font-normal text-base-content/60"
							>ID, title, status, court</span
						>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Case ID *</span>
							<input
								class={`input-bordered input input-sm w-full ${attemptedSubmit && !form.case_id.trim() ? 'input-error' : ''}`}
								bind:value={form.case_id}
								required
								placeholder="DSA-..."
								oninput={clearRequiredError}
							/>
							{#if attemptedSubmit && !form.case_id.trim()}
								<span class="mt-1 text-xs text-error">Case ID is required.</span>
							{/if}
						</label>
						<label class="form-control w-full md:col-span-2">
							<span class="label-text mb-1 text-sm font-semibold">Case title *</span>
							<input
								class={`input-bordered input input-sm w-full ${attemptedSubmit && !form.title.trim() ? 'input-error' : ''}`}
								bind:value={form.title}
								required
								placeholder="Case title"
								oninput={clearRequiredError}
							/>
							{#if attemptedSubmit && !form.title.trim()}
								<span class="mt-1 text-xs text-error">Case title is required.</span>
							{/if}
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">ECLI or identifier</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.ecli}
								placeholder="ECLI:..."
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Court</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.court}
								placeholder="Court"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Jurisdiction</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.jurisdiction}
								placeholder="Country or jurisdiction"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Decision date</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.decision_date}
								type="date"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Status</span>
							<select class="select-bordered select w-full select-sm" bind:value={form.status}>
								{#each statusOptions as option (option)}
									<option value={option}>{option}</option>
								{/each}
							</select>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Publication</span>
							<span class="publication-toggle">
								<input class="peer sr-only" type="checkbox" bind:checked={form.published} />
								<span class="publication-toggle-track" aria-hidden="true">
									<span class="publication-toggle-thumb"></span>
								</span>
								<span class="publication-toggle-text">Published</span>
							</span>
						</label>
					</div>
				</details>

				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm" open>
					<summary class="cursor-pointer text-base font-bold">
						Parties & outcome
						<span class="ml-2 text-sm font-normal text-base-content/60"
							>Who sued, who responded, result</span
						>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Plaintiffs</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.plaintiffs}
								placeholder="Comma separated"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Defendants</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.defendants}
								placeholder="Comma separated"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Outcome</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.outcome}
								placeholder="Granted, dismissed, pending..."
							/>
						</label>
						<label class="form-control w-full md:col-span-2">
							<span class="label-text mb-1 text-sm font-semibold">Courts involved</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.courts}
								placeholder="Comma separated if multiple courts"
							/>
						</label>
					</div>
				</details>

				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
					<summary class="cursor-pointer text-base font-bold">
						Legal classification
						<span class="ml-2 text-sm font-normal text-base-content/60"
							>DSA articles, tags, legal basis</span
						>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">DSA articles</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.dsa_articles}
								placeholder="Comma separated"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Categories</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.categories}
								placeholder="Comma separated"
							/>
						</label>
						<label class="form-control w-full md:col-span-2">
							<span class="label-text mb-1 text-sm font-semibold">Themes</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.themes}
								placeholder="Comma separated"
							/>
						</label>
						<label class="form-control w-full">
							<span class="label-text mb-1 text-sm font-semibold">Case scope</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.case_scope}
								placeholder="private enforcement"
							/>
						</label>
						<label class="form-control w-full md:col-span-2">
							<span class="label-text mb-1 text-sm font-semibold">Legal areas</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.legal_areas}
								placeholder="DSA, GDPR, consumer protection..."
							/>
						</label>
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Legal basis / grounds</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.legal_basis}
								placeholder="Comma separated legal grounds, including non-DSA claims"
							></textarea>
						</label>
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Keywords</span>
							<input
								class="input-bordered input input-sm w-full"
								bind:value={form.keywords}
								placeholder="Comma separated"
							/>
						</label>
					</div>
				</details>

				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
					<summary class="cursor-pointer text-base font-bold">
						Procedure & timeline
						<span class="ml-2 text-sm font-normal text-base-content/60">Events and chronology</span>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Procedural events</span>
							<textarea
								class="textarea-bordered textarea min-h-24 w-full font-mono text-sm"
								bind:value={form.procedural_events}
								placeholder="YYYY-MM-DD | Event label | Short description"
							></textarea>
						</label>
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Timeline</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.timeline}
								placeholder="Key procedural events, dates, or court references"
							></textarea>
						</label>
					</div>
				</details>

				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
					<summary class="cursor-pointer text-base font-bold">
						Sources & documents
						<span class="ml-2 text-sm font-normal text-base-content/60"
							>Files, links, source notes</span
						>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Primary sources</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.primary_sources}
								placeholder="One primary source per line"
							></textarea>
						</label>
						<div class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Uploaded documents</span>
							<input
								id="case-documents-input"
								bind:this={documentInput}
								class="sr-only"
								type="file"
								multiple
								accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.html,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/html,image/jpeg,image/png,image/webp"
								onchange={selectDocuments}
							/>
							<label
								for="case-documents-input"
								class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-base-300 bg-base-200/50 px-5 py-6 text-center transition hover:border-primary hover:bg-primary/5"
							>
								<span class="mb-3 rounded-full bg-primary/15 p-3 text-primary">
									<IconUpload class="h-6 w-6" />
								</span>
								<span class="font-semibold">Choose documents</span>
								<span class="mt-1 text-sm text-base-content/60">
									PDFs, Office files, text, HTML, or images
								</span>
							</label>
							<p class="mt-1 text-xs text-base-content/60">
								Uploaded files are public when this case is public. Use links or notes for
								internal-only material.
							</p>
							{#if selectedDocuments.length}
								<div class="mt-3 grid gap-2 sm:grid-cols-2">
									{#each selectedDocuments as file, index (`${file.name}-${file.size}-${file.lastModified}`)}
										<div
											class="flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm"
										>
											<span class="rounded-lg bg-primary/10 p-2 text-primary">
												<IconFileText class="h-5 w-5" />
											</span>
											<div class="min-w-0 flex-1">
												<div class="truncate text-sm font-medium">{file.name}</div>
												<div class="text-xs text-base-content/60">{formatFileSize(file.size)}</div>
											</div>
											<button
												type="button"
												class="btn btn-circle text-base-content/60 btn-ghost btn-xs hover:text-error"
												aria-label={`Remove ${file.name}`}
												onclick={() => removeSelectedDocument(index)}
											>
												<IconX class="h-4 w-4" />
											</button>
										</div>
									{/each}
								</div>
							{/if}
							{#if existingDocuments.length}
								<div class="mt-3 rounded-lg border border-base-300 p-3 text-sm">
									<div class="font-semibold">Current public files</div>
									<ul class="mt-2 list-disc space-y-1 pl-5">
										{#each existingDocuments as filename (filename)}
											<li>
												<!-- eslint-disable svelte/no-navigation-without-resolve -->
												<a
													class="link"
													href={documentUrl(filename)}
													target="_blank"
													rel="noreferrer"
												>
													{filename}
												</a>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Secondary sources</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.secondary_sources}
								placeholder="One secondary source per line"
							></textarea>
						</label>
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Source limitations</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.source_limitations}
								placeholder="Notes on missing documents, copyright, confidentiality, or source reliability"
							></textarea>
						</label>
					</div>
				</details>

				<details class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
					<summary class="cursor-pointer text-base font-bold">
						Editorial
						<span class="ml-2 text-sm font-normal text-base-content/60"
							>Internal notes and public summary</span
						>
					</summary>
					<div class="mt-4 grid gap-3 md:grid-cols-3">
						<label class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Internal editorial notes</span>
							<textarea
								class="textarea-bordered textarea min-h-20 w-full"
								bind:value={form.editorial_notes}
								placeholder="Internal notes for reviewers; not intended for public display"
							></textarea>
						</label>
						<div class="form-control w-full md:col-span-3">
							<span class="label-text mb-1 text-sm font-semibold">Editorial summary</span>
							<CaseSummaryEditor bind:value={form.summary} />
						</div>
					</div>
				</details>
			</div>

			<div
				class="sticky bottom-0 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 bg-base-100/95 px-4 py-3 shadow-sm backdrop-blur"
			>
				<div class="text-sm text-base-content/60">
					{#if missingRequiredFields().length}
						Required: {missingRequiredFields().join(', ')}
					{:else}
						Ready to save.
					{/if}
				</div>
				<div class="flex gap-2">
					<button class="btn btn-ghost" type="button" onclick={() => goto(resolve('/cases'))}
						>Cancel</button
					>
					<button class="btn btn-primary" type="submit" disabled={saving}>
						{saving ? 'Saving...' : isEditing ? 'Update case' : 'Create case'}
					</button>
				</div>
			</div>
		</form>
	{/if}
</section>

<style>
	.case-editor-form :global(.label-text) {
		color: color-mix(in oklab, currentColor 62%, transparent);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.case-editor-form :global(input:not([type='checkbox']):not([type='file'])),
	.case-editor-form :global(select),
	.case-editor-form :global(textarea) {
		min-height: 2.75rem;
		border-color: color-mix(in oklab, currentColor 24%, transparent);
		background: var(--color-base-100);
		box-shadow: 0 1px 2px color-mix(in oklab, black 8%, transparent);
	}

	.case-editor-form :global(input:not([type='checkbox']):not([type='file']):focus),
	.case-editor-form :global(select:focus),
	.case-editor-form :global(textarea:focus) {
		border-color: var(--color-primary);
		outline: 2px solid color-mix(in oklab, var(--color-primary) 22%, transparent);
		outline-offset: 1px;
	}

	.publication-toggle {
		display: flex;
		min-height: 2.75rem;
		cursor: pointer;
		align-items: center;
		gap: 0.75rem;
		border: 1px solid color-mix(in oklab, currentColor 24%, transparent);
		border-radius: 0.75rem;
		background: var(--color-base-100);
		padding: 0.25rem 0.875rem;
		box-shadow: 0 1px 2px color-mix(in oklab, black 8%, transparent);
	}

	.publication-toggle:focus-within {
		border-color: var(--color-primary);
		outline: 2px solid color-mix(in oklab, var(--color-primary) 22%, transparent);
		outline-offset: 1px;
	}

	.publication-toggle-track {
		display: flex;
		height: 1.35rem;
		width: 2.35rem;
		align-items: center;
		border-radius: 999px;
		background: color-mix(in oklab, currentColor 16%, transparent);
		padding: 0.15rem;
		transition: background-color 120ms ease;
	}

	.publication-toggle-thumb {
		height: 1.05rem;
		width: 1.05rem;
		border-radius: 999px;
		background: var(--color-base-100);
		box-shadow: 0 1px 2px color-mix(in oklab, black 24%, transparent);
		transition: transform 120ms ease;
	}

	.publication-toggle .peer:checked + .publication-toggle-track {
		background: var(--color-primary);
	}

	.publication-toggle .peer:checked + .publication-toggle-track .publication-toggle-thumb {
		transform: translateX(1rem);
	}

	.publication-toggle-text {
		font-weight: 600;
	}
</style>
