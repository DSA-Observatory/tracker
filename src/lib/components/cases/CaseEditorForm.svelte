<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, pb, type CaseRecord } from '$lib/database';
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
				await pb.collection('cases').update<CaseRecord>(caseId, payload);
			} else {
				await pb.collection('cases').create<CaseRecord>(payload);
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
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xs font-semibold tracking-[0.2em] text-base-content/50 uppercase">
				Case editor
			</p>
			<h1 class="text-3xl font-black">{isEditing ? 'Edit case' : 'Create case'}</h1>
		</div>
		<button class="btn btn-ghost" type="button" onclick={() => goto(resolve('/cases'))}
			>Back to cases</button
		>
	</div>

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
				<label class="form-control w-full md:col-span-3">
					<span class="label-text mb-1 text-sm font-semibold">Editorial summary</span>
					<CaseSummaryEditor bind:value={form.summary} />
				</label>
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
