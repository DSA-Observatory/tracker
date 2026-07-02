<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, pb, type CaseRecord, type CaseStatus } from '$lib/database';
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
	let form = $state<CaseForm>(emptyCaseForm());
	let currentRecord = $state<CaseRecord>();
	let existingDocuments = $state<string[]>([]);
	let selectedDocuments = $state<File[]>([]);
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

	const canWrite = $derived(authStore.isAuthenticated);
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
		selectedDocuments = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
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
		if (!file || !canWrite || isEditing || importingCsv) return;

		importingCsv = true;
		importMessage = '';
		error = '';

		try {
			const rows = parseCsv(await file.text());
			const existing = await pb.collection('cases').getFullList<CaseRecord>({ fields: 'case_id' });
			const existingCaseIds = existing.map((record) => record.case_id.trim().toLowerCase());
			let imported = 0;
			let skipped = 0;

			for (const row of rows) {
				const caseId = row.case_id?.trim();
				const title = row.title?.trim();
				if (!caseId || !title || existingCaseIds.includes(caseId.toLowerCase())) {
					skipped += 1;
					continue;
				}

				await pb.collection('cases').create<CaseRecord>(csvRowToCase(row));
				existingCaseIds.push(caseId.toLowerCase());
				imported += 1;
			}

			importMessage = `Imported ${imported} case${imported === 1 ? '' : 's'}${skipped ? `; skipped ${skipped}` : ''}.`;
		} catch (err) {
			console.error('Error importing CSV:', err);
			error = 'Could not import CSV. Check the columns and your permissions.';
		} finally {
			input.value = '';
			importingCsv = false;
		}
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

		return Object.fromEntries(
			csvColumns.map((field) => {
				const value = row[field]?.trim() ?? '';
				if (field === 'status') return [field, status];
				if (field === 'decision_date') return [field, value || null];
				if (field === 'primary_sources' || field === 'secondary_sources') {
					return [field, splitCaseFormLines(value)];
				}
				if (isCsvListField(field)) return [field, splitCsvList(value)];
				return [field, value];
			})
		);
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
		sample.decision_date = '2026-01-31';
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
		if (!canWrite || !form.case_id.trim() || !form.title.trim()) return;

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
			error = 'Could not save the case. Check required fields and permissions.';
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
				<button class="btn btn-outline btn-sm" type="button" onclick={downloadCsvTemplate}
					>Template</button
				>
				<button
					class="btn btn-outline btn-sm"
					type="button"
					disabled={importingCsv}
					onclick={() => csvInput?.click()}>{importingCsv ? 'Importing' : 'Import CSV'}</button
				>
			{/if}
			<button class="btn btn-ghost" type="button" onclick={() => goto(resolve('/cases'))}
				>Back to cases</button
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
			class="border border-base-300 bg-base-100 p-4 shadow-sm"
			onsubmit={(event) => {
				event.preventDefault();
				saveCase();
			}}
		>
			{#if error}
				<div class="mb-4 alert alert-error">{error}</div>
			{/if}

			<div class="grid gap-3 md:grid-cols-3">
				<label class="form-control w-full">
					<span class="label-text mb-1 text-sm font-semibold">Case ID</span>
					<input
						class="input-bordered input input-sm w-full"
						bind:value={form.case_id}
						required
						placeholder="DSA-..."
					/>
				</label>
				<label class="form-control w-full md:col-span-2">
					<span class="label-text mb-1 text-sm font-semibold">Case title</span>
					<input
						class="input-bordered input input-sm w-full"
						bind:value={form.title}
						required
						placeholder="Case title"
					/>
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
						{#each statusOptions as option}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
				<label class="form-control w-full">
					<span class="label-text mb-1 text-sm font-semibold">Publication</span>
					<span
						class="label min-h-8 cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3"
					>
						<input
							class="checkbox checkbox-primary"
							type="checkbox"
							bind:checked={form.published}
						/>
						<span class="label-text">Published</span>
					</span>
				</label>
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
						class="file-input-bordered file-input w-full"
						type="file"
						multiple
						accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.html,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/html,image/jpeg,image/png,image/webp"
						onchange={selectDocuments}
					/>
					<p class="mt-1 text-xs text-base-content/60">
						Uploaded files are public when this case is public. Use links or notes for internal-only
						material.
					</p>
					{#if selectedDocuments.length}
						<p class="mt-2 text-sm text-base-content/70">
							Selected: {selectedDocuments.map((file) => file.name).join(', ')}
						</p>
					{/if}
					{#if existingDocuments.length}
						<div class="mt-3 rounded-lg border border-base-300 p-3 text-sm">
							<div class="font-semibold">Current public files</div>
							<ul class="mt-2 list-disc space-y-1 pl-5">
								{#each existingDocuments as filename}
									<li>
										<a class="link" href={documentUrl(filename)} target="_blank" rel="noreferrer">
											{filename}
										</a>
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
				<label class="form-control w-full md:col-span-3">
					<span class="label-text mb-1 text-sm font-semibold">Internal editorial notes</span>
					<textarea
						class="textarea-bordered textarea min-h-20 w-full"
						bind:value={form.editorial_notes}
						placeholder="Internal notes for reviewers; not intended for public display"
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
				<div class="form-control w-full md:col-span-3">
					<span class="label-text mb-1 text-sm font-semibold">Editorial summary</span>
					<CaseSummaryEditor bind:value={form.summary} />
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button class="btn btn-ghost" type="button" onclick={() => goto(resolve('/cases'))}
					>Cancel</button
				>
				<button
					class="btn btn-primary"
					type="submit"
					disabled={saving || !form.case_id.trim() || !form.title.trim()}
				>
					{saving ? 'Saving...' : isEditing ? 'Update case' : 'Create case'}
				</button>
			</div>
		</form>
	{/if}
</section>
