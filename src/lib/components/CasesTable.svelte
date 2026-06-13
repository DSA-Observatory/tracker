<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore, pb, type CaseRecord, type CaseStatus } from '$lib/database';
	import { debounce } from '$lib/utils/debounce';

	const statusOptions: CaseStatus[] = [
		'draft',
		'review',
		'pending',
		'decided',
		'appealed',
		'closed',
		'published'
	];

	type CaseForm = {
		case_id: string;
		title: string;
		ecli: string;
		decision_date: string;
		status: CaseStatus;
		court: string;
		jurisdiction: string;
		plaintiffs: string;
		defendants: string;
		summary: string;
		keywords: string;
		dsa_articles: string;
		published: boolean;
	};

	const emptyForm = (): CaseForm => ({
		case_id: '',
		title: '',
		ecli: '',
		decision_date: '',
		status: 'draft',
		court: '',
		jurisdiction: '',
		plaintiffs: '',
		defendants: '',
		summary: '',
		keywords: '',
		dsa_articles: '',
		published: false
	});

	let cases = $state<CaseRecord[]>([]);
	let search = $state('');
	let status = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let editingId = $state<string | null>(null);
	let form = $state<CaseForm>(emptyForm());

	const canWrite = $derived(authStore.isAuthenticated);

	const splitList = (value: string) =>
		value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);

	const joinList = (value?: string[]) => (Array.isArray(value) ? value.join(', ') : '');

	function getFilter() {
		const filters: string[] = [];

		if (search.trim()) {
			filters.push(
				pb.filter(
					'(case_id ~ {:q} || title ~ {:q} || ecli ~ {:q} || court ~ {:q} || jurisdiction ~ {:q} || summary ~ {:q})',
					{ q: search.trim() }
				)
			);
		}

		if (status) {
			filters.push(pb.filter('status = {:status}', { status }));
		}

		return filters.join(' && ');
	}

	async function loadCases() {
		loading = true;
		error = '';

		try {
			cases = await pb.collection('cases').getFullList<CaseRecord>({
				sort: '-decision_date,-created',
				filter: getFilter()
			});
		} catch (err) {
			console.error('Error loading cases:', err);
			error = 'Could not load cases. Check PocketBase availability and collection rules.';
		} finally {
			loading = false;
		}
	}

	const debouncedLoadCases = debounce(loadCases, 250);

	function editCase(record: CaseRecord) {
		editingId = record.id;
		form = {
			case_id: record.case_id,
			title: record.title,
			ecli: record.ecli ?? '',
			decision_date: record.decision_date ? record.decision_date.slice(0, 10) : '',
			status: record.status,
			court: record.court ?? '',
			jurisdiction: record.jurisdiction ?? '',
			plaintiffs: joinList(record.plaintiffs),
			defendants: joinList(record.defendants),
			summary: record.summary ?? '',
			keywords: joinList(record.keywords),
			dsa_articles: joinList(record.dsa_articles),
			published: record.published
		};
	}

	function resetForm() {
		editingId = null;
		form = emptyForm();
	}

	async function saveCase() {
		if (!form.case_id.trim() || !form.title.trim()) return;

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
			plaintiffs: splitList(form.plaintiffs),
			defendants: splitList(form.defendants),
			summary: form.summary.trim(),
			keywords: splitList(form.keywords),
			dsa_articles: splitList(form.dsa_articles),
			published: form.published || form.status === 'published'
		};

		try {
			if (editingId) {
				await pb.collection('cases').update<CaseRecord>(editingId, payload);
			} else {
				await pb.collection('cases').create<CaseRecord>(payload);
			}

			resetForm();
			await loadCases();
		} catch (err) {
			console.error('Error saving case:', err);
			error = 'Could not save the case. Check required fields and permissions.';
		} finally {
			saving = false;
		}
	}

	async function deleteCase(record: CaseRecord) {
		if (!confirm(`Delete ${record.case_id}: ${record.title}?`)) return;

		try {
			await pb.collection('cases').delete(record.id);
			cases = cases.filter((item) => item.id !== record.id);
		} catch (err) {
			console.error('Error deleting case:', err);
			error = 'Could not delete the case. Check your permissions.';
		}
	}

	onMount(loadCases);
</script>

<section id="cases" class="container mx-auto max-w-7xl px-4 py-16">
	<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Case database</p>
			<h2 class="mt-3 text-3xl font-black">Search and maintain the tracker list.</h2>
			<p class="mt-3 max-w-2xl text-base-content/70">
				Published cases are public. Signed-in editors can create, update, and delete records directly in
				this table.
			</p>
		</div>
		<a class="btn btn-outline" href="/login">Editor login</a>
	</div>

	<div class="mb-6 grid gap-3 md:grid-cols-[1fr_220px]">
		<label class="input input-bordered flex items-center gap-2">
			<span class="text-base-content/50">Search</span>
			<input
				class="grow"
				type="search"
				bind:value={search}
				oninput={debouncedLoadCases}
				placeholder="Title, ECLI, court, jurisdiction, summary"
			/>
		</label>
		<select class="select select-bordered w-full" bind:value={status} onchange={loadCases}>
			<option value="">All statuses</option>
			{#each statusOptions as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	</div>

	{#if canWrite}
		<form
			class="mb-8 rounded-[2rem] border border-base-300 bg-base-100 p-5 shadow-sm"
			onsubmit={(event) => {
				event.preventDefault();
				saveCase();
			}}
		>
			<div class="mb-4 flex items-center justify-between gap-3">
				<h3 class="text-xl font-black">{editingId ? 'Edit case' : 'Create case'}</h3>
				{#if editingId}
					<button class="btn btn-ghost btn-sm" type="button" onclick={resetForm}>Cancel edit</button>
				{/if}
			</div>

			<div class="grid gap-3 md:grid-cols-3">
				<input class="input input-bordered" bind:value={form.case_id} required placeholder="Case ID" />
				<input
					class="input input-bordered md:col-span-2"
					bind:value={form.title}
					required
					placeholder="Case title"
				/>
				<input class="input input-bordered" bind:value={form.ecli} placeholder="ECLI or identifier" />
				<input class="input input-bordered" bind:value={form.court} placeholder="Court" />
				<input class="input input-bordered" bind:value={form.jurisdiction} placeholder="Jurisdiction" />
				<input
					class="input input-bordered"
					bind:value={form.decision_date}
					type="date"
					aria-label="Decision date"
				/>
				<select class="select select-bordered" bind:value={form.status}>
					{#each statusOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
				<label class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-4">
					<input class="checkbox checkbox-primary" type="checkbox" bind:checked={form.published} />
					<span class="label-text">Published</span>
				</label>
				<input
					class="input input-bordered"
					bind:value={form.plaintiffs}
					placeholder="Plaintiffs, comma separated"
				/>
				<input
					class="input input-bordered"
					bind:value={form.defendants}
					placeholder="Defendants, comma separated"
				/>
				<input
					class="input input-bordered"
					bind:value={form.dsa_articles}
					placeholder="DSA articles, comma separated"
				/>
				<input
					class="input input-bordered md:col-span-3"
					bind:value={form.keywords}
					placeholder="Keywords, comma separated"
				/>
				<textarea
					class="textarea textarea-bordered md:col-span-3"
					bind:value={form.summary}
					rows="3"
					placeholder="Editorial summary"
				></textarea>
			</div>

			<div class="mt-4 flex justify-end">
				<button
					class="btn btn-primary"
					type="submit"
					disabled={saving || !form.case_id.trim() || !form.title.trim()}
				>
					{saving ? 'Saving...' : editingId ? 'Update case' : 'Create case'}
				</button>
			</div>
		</form>
	{/if}

	{#if error}
		<div class="alert alert-error mb-5">{error}</div>
	{/if}

	<div class="overflow-x-auto rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
		<table class="table table-zebra">
			<thead>
				<tr>
					<th>Case</th>
					<th>Status</th>
					<th>Jurisdiction</th>
					<th>Court</th>
					<th>Decision</th>
					<th>Tags</th>
					{#if canWrite}<th class="text-right">Actions</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan={canWrite ? 7 : 6}>Loading cases...</td>
					</tr>
				{:else if cases.length === 0}
					<tr>
						<td colspan={canWrite ? 7 : 6}>No cases found.</td>
					</tr>
				{:else}
					{#each cases as record (record.id)}
						<tr>
							<td class="min-w-72">
								<div class="font-bold">{record.title}</div>
								<div class="text-sm text-base-content/60">
									{record.case_id}{record.ecli ? ` · ${record.ecli}` : ''}
								</div>
								{#if record.summary}
									<div class="mt-2 line-clamp-2 max-w-xl text-sm text-base-content/70">
										{@html record.summary}
									</div>
								{/if}
							</td>
							<td><span class="badge badge-outline">{record.status}</span></td>
							<td>{record.jurisdiction || '-'}</td>
							<td>{record.court || '-'}</td>
							<td>{record.decision_date ? new Date(record.decision_date).toLocaleDateString() : '-'}</td>
							<td class="min-w-56">
								<div class="flex flex-wrap gap-1">
									{#each [...(record.dsa_articles ?? []), ...(record.keywords ?? [])].slice(0, 5) as tag}
										<span class="badge badge-ghost">{tag}</span>
									{/each}
								</div>
							</td>
							{#if canWrite}
								<td class="text-right">
									<div class="join">
										<button class="btn btn-sm join-item" type="button" onclick={() => editCase(record)}>
											Edit
										</button>
										<button
											class="btn btn-sm btn-error join-item"
											type="button"
											onclick={() => deleteCase(record)}
										>
											Delete
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
