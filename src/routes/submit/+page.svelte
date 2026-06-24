<script lang="ts">
	import { pb } from '$lib/database';
	import { statusOptions } from '$lib/components/cases/types';

	let caseId = $state('');
	let title = $state('');
	let ecli = $state('');
	let filingDate = $state('');
	let decisionDate = $state('');
	let caseStatus = $state('review');
	let outcome = $state('');
	let jurisdiction = $state('');
	let court = $state('');
	let courts = $state('');
	let plaintiffs = $state('');
	let defendants = $state('');
	let dsaArticles = $state('');
	let categories = $state('');
	let themes = $state('');
	let legalAreas = $state('');
	let legalBasis = $state('');
	let caseScope = $state('private enforcement');
	let proceduralEvents = $state('');
	let timeline = $state('');
	let primarySources = $state('');
	let secondarySources = $state('');
	let sourceLimitations = $state('');
	let keywords = $state('');
	let caseUrl = $state('');
	let summary = $state('');
	let submitterName = $state('');
	let submitterEmail = $state('');
	let saving = $state(false);
	let error = $state('');
	let success = $state(false);

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

	function splitProceduralEvents(value: string) {
		return splitLines(value).map((line) => {
			const [date, label, description] = line.split('|').map((part) => part.trim());
			return { date, label, description };
		});
	}

	async function submitCaseLead() {
		if (!title.trim() || !summary.trim()) {
			error = 'Add a case title and short explanation.';
			return;
		}

		saving = true;
		error = '';
		success = false;

		try {
			await pb.collection('case_submissions').create({
				case_id: caseId.trim(),
				title: title.trim(),
				ecli: ecli.trim(),
				filing_date: filingDate || null,
				decision_date: decisionDate || null,
				case_status: caseStatus,
				outcome: outcome.trim(),
				jurisdiction: jurisdiction.trim(),
				court: court.trim(),
				courts: splitList(courts),
				plaintiffs: splitList(plaintiffs),
				defendants: splitList(defendants),
				legal_areas: splitList(legalAreas),
				legal_basis: splitList(legalBasis),
				case_scope: caseScope.trim(),
				procedural_events: splitProceduralEvents(proceduralEvents),
				timeline: timeline.trim(),
				categories: splitList(categories),
				themes: splitList(themes),
				primary_sources: splitLines(primarySources),
				secondary_sources: splitLines(secondarySources),
				keywords: splitList(keywords),
				dsa_articles: splitList(dsaArticles),
				document_links: splitLines(caseUrl),
				case_url: splitLines(caseUrl)[0] ?? '',
				summary: summary.trim(),
				source_limitations: sourceLimitations.trim(),
				submitter_name: submitterName.trim(),
				submitter_email: submitterEmail.trim(),
				status: 'new'
			});

			caseId = '';
			title = '';
			ecli = '';
			filingDate = '';
			decisionDate = '';
			caseStatus = 'review';
			outcome = '';
			jurisdiction = '';
			court = '';
			courts = '';
			plaintiffs = '';
			defendants = '';
			dsaArticles = '';
			categories = '';
			themes = '';
			legalAreas = '';
			legalBasis = '';
			caseScope = 'private enforcement';
			proceduralEvents = '';
			timeline = '';
			primarySources = '';
			secondarySources = '';
			sourceLimitations = '';
			keywords = '';
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

<main class="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<p class="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
			Community submission
		</p>
		<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Suggest a case</h1>
		<p class="mt-4 max-w-2xl text-slate-600">
			Submit a DSA-related private enforcement case lead for editorial review. Submissions are not
			published automatically.
		</p>

		{#if success}
			<div class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
				Thank you. The case lead has been added to the editorial review queue.
			</div>
		{/if}

		{#if error}
			<div class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
		{/if}

		<form
			class="mt-8 grid gap-4 md:grid-cols-2"
			onsubmit={(event) => {
				event.preventDefault();
				submitCaseLead();
			}}
		>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Case ID</span>
				<input class="input-bordered input w-full" bind:value={caseId} placeholder="DSA-..." />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">ECLI or identifier</span>
				<input class="input-bordered input w-full" bind:value={ecli} placeholder="ECLI:..." />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Case title or name</span>
				<input class="input-bordered input w-full" bind:value={title} required />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Filing date</span>
				<input class="input-bordered input w-full" bind:value={filingDate} type="date" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Decision date</span>
				<input class="input-bordered input w-full" bind:value={decisionDate} type="date" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Case status</span>
				<select class="select-bordered select w-full" bind:value={caseStatus}>
					{#each statusOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Outcome</span>
				<input class="input-bordered input w-full" bind:value={outcome} />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Jurisdiction</span>
				<input class="input-bordered input w-full" bind:value={jurisdiction} />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Court</span>
				<input class="input-bordered input w-full" bind:value={court} />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Courts involved</span>
				<input class="input-bordered input w-full" bind:value={courts} placeholder="Comma separated" />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Plaintiffs</span>
				<input
					class="input-bordered input w-full"
					bind:value={plaintiffs}
					placeholder="Comma separated"
				/>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Defendants</span>
				<input
					class="input-bordered input w-full"
					bind:value={defendants}
					placeholder="Comma separated"
				/>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">DSA articles</span>
				<input class="input-bordered input w-full" bind:value={dsaArticles} placeholder="Comma separated" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Categories</span>
				<input class="input-bordered input w-full" bind:value={categories} placeholder="Comma separated" />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Themes</span>
				<input class="input-bordered input w-full" bind:value={themes} placeholder="Comma separated" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Case scope</span>
				<input class="input-bordered input w-full" bind:value={caseScope} />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Legal areas</span>
				<input class="input-bordered input w-full" bind:value={legalAreas} placeholder="Comma separated" />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Legal basis / grounds</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={legalBasis}></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Procedural events</span>
				<textarea
					class="textarea-bordered textarea min-h-24 w-full font-mono text-sm"
					bind:value={proceduralEvents}
					placeholder="YYYY-MM-DD | Event label | Short description"
				></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Timeline</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={timeline}></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Primary sources</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={primarySources}></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Secondary sources</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={secondarySources}></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Source or document URLs</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={caseUrl} placeholder="One URL per line"></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Why should this be tracked?</span>
				<textarea class="textarea-bordered textarea min-h-36 w-full" bind:value={summary} required
				></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Source limitations</span>
				<textarea class="textarea-bordered textarea min-h-20 w-full" bind:value={sourceLimitations}></textarea>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Keywords</span>
				<input class="input-bordered input w-full" bind:value={keywords} placeholder="Comma separated" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Your name</span>
				<input class="input-bordered input w-full" bind:value={submitterName} />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Your email</span>
				<input class="input-bordered input w-full" bind:value={submitterEmail} type="email" />
			</label>
			<div class="md:col-span-2">
				<button class="btn btn-primary" type="submit" disabled={saving}>
					{saving ? 'Submitting...' : 'Submit case lead'}
				</button>
			</div>
		</form>
	</section>
</main>
