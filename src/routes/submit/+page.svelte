<script lang="ts">
	import { pb } from '$lib/database';

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

	async function submitCaseLead() {
		if (!title.trim() || !summary.trim() || !caseUrl.trim()) {
			error = 'Add a case title, source link, and short explanation.';
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
				status: 'new'
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
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Case title or name</span>
				<input
					class="input-bordered input w-full"
					bind:value={title}
					required
					placeholder="Platform v claimant, court name, or common case name"
				/>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Source or document URL</span>
				<textarea
					class="textarea-bordered textarea min-h-20 w-full"
					bind:value={caseUrl}
					required
					placeholder="One URL per line"
				></textarea>
				<span class="mt-1 text-sm text-slate-500"
					>Court page, judgment PDF, article, or another source we can verify.</span
				>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Why should this be tracked?</span>
				<textarea
					class="textarea-bordered textarea min-h-36 w-full"
					bind:value={summary}
					required
					placeholder="Briefly explain the DSA relevance, issue, or procedural importance."
				></textarea>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Jurisdiction</span>
				<input
					class="input-bordered input w-full"
					bind:value={jurisdiction}
					placeholder="Country"
				/>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Court</span>
				<input class="input-bordered input w-full" bind:value={court} />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Decision date</span>
				<input class="input-bordered input w-full" bind:value={decisionDate} type="date" />
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">DSA articles</span>
				<input
					class="input-bordered input w-full"
					bind:value={dsaArticles}
					placeholder="Comma separated"
				/>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Plaintiffs</span>
				<input
					class="input-bordered input w-full"
					bind:value={plaintiffs}
					placeholder="Comma separated"
				/>
			</label>
			<label class="form-control">
				<span class="label-text mb-1 font-semibold">Defendants</span>
				<input
					class="input-bordered input w-full"
					bind:value={defendants}
					placeholder="Comma separated"
				/>
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
