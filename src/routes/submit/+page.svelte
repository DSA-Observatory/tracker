<script lang="ts">
	import { pb } from '$lib/database';

	let title = $state('');
	let jurisdiction = $state('');
	let court = $state('');
	let parties = $state('');
	let caseUrl = $state('');
	let summary = $state('');
	let submitterName = $state('');
	let submitterEmail = $state('');
	let saving = $state(false);
	let error = $state('');
	let success = $state(false);

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
				title: title.trim(),
				jurisdiction: jurisdiction.trim(),
				court: court.trim(),
				parties: parties.trim(),
				case_url: caseUrl.trim(),
				summary: summary.trim(),
				submitter_name: submitterName.trim(),
				submitter_email: submitterEmail.trim(),
				status: 'new'
			});

			title = '';
			jurisdiction = '';
			court = '';
			parties = '';
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
				<input class="input-bordered input w-full" bind:value={title} required />
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
				<span class="label-text mb-1 font-semibold">Parties</span>
				<input
					class="input-bordered input w-full"
					bind:value={parties}
					placeholder="Plaintiff v defendant"
				/>
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Source or document URL</span>
				<input class="input-bordered input w-full" bind:value={caseUrl} type="url" />
			</label>
			<label class="form-control md:col-span-2">
				<span class="label-text mb-1 font-semibold">Why should this be tracked?</span>
				<textarea class="textarea-bordered textarea min-h-36 w-full" bind:value={summary} required
				></textarea>
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
