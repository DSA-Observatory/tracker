<script lang="ts">
	import { pb } from '$lib/database';
	import { tick } from 'svelte';

	let title = $state('');
	let decisionDate = $state('');
	let jurisdiction = $state('');
	let court = $state('');
	let plaintiffs = $state('');
	let defendants = $state('');
	let dsaArticles = $state('');
	let caseUrl = $state('');
	let summary = $state('');
	let submitterName = $state('');
	let submitterEmail = $state('');
	let saving = $state(false);
	let error = $state('');
	let success = $state(false);
	let fieldErrors = $state<Record<string, string>>({});
	let contactDetailsOpen = $state(false);
	const countries = ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'];

	function splitList(value: string) {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function splitLines(value: string) {
		return value
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	async function submitCaseLead(form: HTMLFormElement) {
		if (saving) return;
		fieldErrors = {};
		error = '';
		if (!title.trim()) fieldErrors.title = 'Add a case name or a short identifying title.';
		if (!summary.trim()) fieldErrors.summary = 'Briefly explain how the case relates to the DSA.';
		if (!caseUrl.trim()) fieldErrors.caseUrl = 'Add at least one source link.';
		else if (splitLines(caseUrl).some((link) => {
			try { return !['https:', 'http:'].includes(new URL(link).protocol); }
			catch { return true; }
		})) fieldErrors.caseUrl = 'Use a complete http:// or https:// URL, one per line.';
		const emailInput = form.elements.namedItem('submitterEmail') as HTMLInputElement;
		if (!emailInput.validity.valid) fieldErrors.submitterEmail = 'Enter a valid email address or leave this blank.';
		if (Object.keys(fieldErrors).length) {
			if (fieldErrors.submitterEmail) {
				contactDetailsOpen = true;
				await tick();
			}
			(form.elements.namedItem(Object.keys(fieldErrors)[0]) as HTMLElement)?.focus();
			return;
		}

		saving = true;
		error = '';
		success = false;

		try {
			await pb.collection('case_submissions').create({
				title: title.trim(),
				decision_date: decisionDate || null,
				jurisdiction: jurisdiction.trim(),
				court: court.trim(),
				plaintiffs: splitList(plaintiffs),
				defendants: splitList(defendants),
				dsa_articles: splitList(dsaArticles),
				document_links: splitLines(caseUrl),
				case_url: splitLines(caseUrl)[0] ?? '',
				summary: summary.trim(),
				submitter_name: submitterName.trim(),
				submitter_email: submitterEmail.trim(),
				status: 'pending'
			});

			title = '';
			decisionDate = '';
			jurisdiction = '';
			court = '';
			plaintiffs = '';
			defendants = '';
			dsaArticles = '';
			caseUrl = '';
			summary = '';
			submitterName = '';
			submitterEmail = '';
			success = true;
		} catch (err) {
			console.error('Error submitting case lead:', err);
			error = 'Could not submit this case lead. Please try again later.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Suggest a Case | DSA Case Law Tracker</title>
	<meta name="description" content="Suggest a DSA private enforcement case for editorial review." />
</svelte:head>

<main
	class="-mt-4 min-h-[calc(100dvh-4rem)] bg-base-200/60 px-4 pt-4 pb-16 sm:-mt-10 sm:px-6 sm:pt-10 lg:px-8"
>
	<section
		class="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
	>
		<h1 class="text-4xl font-black tracking-tight text-slate-950">Suggest a case</h1>
		<p class="mt-4 max-w-2xl leading-7 text-slate-600">
			Share a private enforcement case relating to the Digital Services Act. A case name, a source link, and a short explanation are enough to submit a lead.
		</p>

		{#if success}
			<div role="status" class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
				<strong class="block">Thank you for your submission.</strong>
				The case lead is in the editorial review queue. It will not be published automatically.
			</div>
		{/if}

		{#if error}
			<div role="alert" class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
		{/if}

		<form
			class="suggest-case-form mt-8"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				submitCaseLead(event.currentTarget);
			}}
		>
			<fieldset disabled={saving} class="space-y-4">
				<legend class="sr-only">Required case information</legend>
				<label class="field"><span class="field-label">Case name or title</span><span id="title-help" class="field-help">Use the parties’ names or another title that identifies the case.</span>
					<input name="title" class="input w-full" bind:value={title} required aria-invalid={!!fieldErrors.title} aria-describedby={`title-help${fieldErrors.title ? ' title-error' : ''}`} />
					{#if fieldErrors.title}<span id="title-error" class="field-error">{fieldErrors.title}</span>{/if}
				</label>
				<label class="field"><span class="field-label">Source links</span><span id="source-help" class="field-help">A court page, judgment, or report we can verify. Add one complete URL per line.</span>
					<textarea name="caseUrl" class="textarea w-full" rows="2" bind:value={caseUrl} required spellcheck="false" aria-invalid={!!fieldErrors.caseUrl} aria-describedby={`source-help${fieldErrors.caseUrl ? ' source-error' : ''}`}></textarea>
					{#if fieldErrors.caseUrl}<span id="source-error" class="field-error">{fieldErrors.caseUrl}</span>{/if}
				</label>
				<label class="field"><span class="field-label">How does the case relate to the DSA?</span><span id="summary-help" class="field-help">Briefly describe the issue, relevant provisions, or procedural significance. You do not need a full case summary.</span>
					<textarea name="summary" class="textarea w-full" rows="4" bind:value={summary} required aria-invalid={!!fieldErrors.summary} aria-describedby={`summary-help${fieldErrors.summary ? ' summary-error' : ''}`}></textarea>
					{#if fieldErrors.summary}<span id="summary-error" class="field-error">{fieldErrors.summary}</span>{/if}
				</label>
			</fieldset>
			<details class="case-details">
				<summary class="section-title">Additional case details <span>Optional</span></summary>
				<fieldset disabled={saving} class="grid gap-5 md:grid-cols-2">
					<legend class="sr-only">Optional case details</legend>
					<label class="field"><span class="field-label">Jurisdiction</span><input class="input w-full" list="jurisdictions" bind:value={jurisdiction} placeholder="Select or enter a country" /><datalist id="jurisdictions">{#each countries as country}<option value={country}></option>{/each}</datalist></label>
					<label class="field"><span class="field-label">Court</span><input class="input w-full" bind:value={court} /></label>
					<label class="field"><span class="field-label">Decision date</span><input class="input w-full" bind:value={decisionDate} type="date" /></label>
					<label class="field"><span class="field-label">DSA articles</span><input class="input w-full" bind:value={dsaArticles} aria-describedby="articles-help" /><span id="articles-help" class="field-help">Separate provisions with commas, e.g. Article 16, Article 20.</span></label>
					<label class="field"><span class="field-label">Plaintiffs</span><input class="input w-full" bind:value={plaintiffs} aria-describedby="plaintiffs-help" /><span id="plaintiffs-help" class="field-help">Separate multiple names with commas.</span></label>
					<label class="field"><span class="field-label">Defendants</span><input class="input w-full" bind:value={defendants} aria-describedby="defendants-help" /><span id="defendants-help" class="field-help">Separate multiple names with commas.</span></label>
				</fieldset>
			</details>
			<details class="contact-section" bind:open={contactDetailsOpen}>
				<summary class="section-title">Contact details <span>Optional</span></summary>
				<fieldset disabled={saving}>
					<legend class="sr-only">Optional contact details</legend>
					<p class="field-help mb-5">Leave your contact details if you are available for questions about this case.</p>
					<div class="grid gap-5 md:grid-cols-2">
						<label class="field"><span class="field-label">Your name</span><input class="input w-full" bind:value={submitterName} autocomplete="name" /></label>
						<label class="field"><span class="field-label">Your email</span><input name="submitterEmail" class="input w-full" bind:value={submitterEmail} type="email" autocomplete="email" aria-invalid={!!fieldErrors.submitterEmail} aria-describedby={fieldErrors.submitterEmail ? 'email-error' : undefined} />{#if fieldErrors.submitterEmail}<span id="email-error" class="field-error">{fieldErrors.submitterEmail}</span>{/if}</label>
					</div>
				</fieldset>
			</details>
			<div class="submission-footer"><button class="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit for review'} <span aria-hidden="true">→</span></button><p>Submissions are reviewed before publication.</p></div>
		</form>
	</section>
</main>

<style>
	@media (prefers-reduced-motion: no-preference) {
		h1 { animation: form-entry .75s cubic-bezier(.16, 1, .3, 1) backwards; }
		h1 + p { animation: form-entry .75s .08s cubic-bezier(.16, 1, .3, 1) backwards; }
		.suggest-case-form > fieldset:first-child { animation: form-entry .75s .16s cubic-bezier(.16, 1, .3, 1) backwards; }
		.case-details { animation: form-entry .75s .24s cubic-bezier(.16, 1, .3, 1) backwards; }
		.contact-section { animation: form-entry .75s .32s cubic-bezier(.16, 1, .3, 1) backwards; }
		.submission-footer { animation: form-entry .75s .4s cubic-bezier(.16, 1, .3, 1) backwards; }
	}
	@keyframes form-entry {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.field { display: flex; flex-direction: column; gap: .5rem; }
	.field-label { color: #0f172a; font-size: .95rem; font-weight: 600; }
	.field-help { color: #475569; font-size: .85rem; line-height: 1.6; }
	.field-error { color: #b91c1c; font-size: .85rem; }
	.section-title { width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; color: #0f172a; font-size: 1.1rem; font-weight: 700; cursor: pointer; list-style-position: outside; }
	.section-title::before { content: '›'; display: inline-block; transition: transform .15s ease; }
	.section-title span { font-size: .75rem; font-weight: 500; color: #475569; background: #f1f5f9; padding: .25rem .6rem; border-radius: 999px; }
	.case-details { margin-block: 2rem; padding: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: .75rem; }
	details[open] > .section-title::before { transform: rotate(90deg); }
	.case-details[open] .section-title, .contact-section[open] .section-title { margin-bottom: 1.5rem; }
	.contact-section { padding: .5rem 0; }
	.submission-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
	.submission-footer p { font-size: .8rem; color: #475569; }
	.suggest-case-form [aria-invalid='true'] { border-color: #b91c1c; }

	.suggest-case-form :global(input),
	.suggest-case-form :global(textarea) {
		min-height: 2.75rem;
		border-color: #cbd5e1;
		background: #fff;
		box-shadow: 0 1px 2px color-mix(in oklab, black 8%, transparent);
	}
	.suggest-case-form textarea { min-height: unset; }

	.suggest-case-form :global(input:focus),
	.suggest-case-form :global(textarea:focus) {
		border-color: var(--color-primary);
		outline: 2px solid color-mix(in oklab, var(--color-primary) 22%, transparent);
		outline-offset: 1px;
	}
</style>
