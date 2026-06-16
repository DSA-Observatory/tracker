<script lang="ts">
	import { base } from '$app/paths';
	import { authStore, pb } from '$lib/database';
	import { isAdminEmail } from '$lib/admin';

	type ManagedUser = {
		id: string;
		email: string;
		name?: string;
		username?: string;
		verified: boolean;
		emailVisibility?: boolean;
		created: string;
		updated: string;
	};

	let users = $state<ManagedUser[]>([]);
	let isLoading = $state(true);
	let error = $state('');
	let success = $state('');
	let savingUserId = $state('');
	let hasLoadedUsers = $state(false);

	const canAdmin = $derived(authStore.isAuthenticated && authStore.isAdmin);

	$effect(() => {
		if (canAdmin) {
			if (hasLoadedUsers) return;

			hasLoadedUsers = true;
			loadUsers();
		} else {
			hasLoadedUsers = false;
			isLoading = false;
		}
	});

	function formatDate(value?: string) {
		if (!value) return 'Unknown';

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function loadUsers() {
		isLoading = true;
		error = '';

		try {
			users = await pb.collection('users').getFullList<ManagedUser>({
				sort: '-created'
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load users.';
		} finally {
			isLoading = false;
		}
	}

	async function updateUser(user: ManagedUser, changes: Partial<ManagedUser>) {
		savingUserId = user.id;
		error = '';
		success = '';

		try {
			const updated = await pb.collection('users').update<ManagedUser>(user.id, changes);
			users = users.map((item) => (item.id === user.id ? updated : item));
			success = `Updated ${updated.email}.`;
		} catch (err) {
			error = err instanceof Error ? err.message : `Could not update ${user.email}.`;
		} finally {
			savingUserId = '';
		}
	}

	async function deleteUser(user: ManagedUser) {
		if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;

		savingUserId = user.id;
		error = '';
		success = '';

		try {
			await pb.collection('users').delete(user.id);
			users = users.filter((item) => item.id !== user.id);
			success = `Deleted ${user.email}.`;
		} catch (err) {
			error = err instanceof Error ? err.message : `Could not delete ${user.email}.`;
		} finally {
			savingUserId = '';
		}
	}
</script>

<svelte:head>
	<title>Admin | DSA Case Law Tracker</title>
	<meta name="description" content="Manage DSA Case Law Tracker users." />
</svelte:head>

<main class="container mx-auto max-w-6xl px-4 pb-16">
	<section class="rounded-[2rem] border border-base-300/60 bg-base-100 p-6 shadow-lg shadow-black/5 sm:p-8">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Admin</p>
				<h1 class="mt-3 text-4xl font-black">User management</h1>
				<p class="mt-3 max-w-2xl text-base-content/70">
					Review users, update names, toggle verification, and remove accounts.
				</p>
			</div>

			{#if canAdmin}
				<button class="btn btn-outline" type="button" onclick={loadUsers} disabled={isLoading}>
					Refresh
				</button>
			{/if}
		</div>

		{#if !authStore.isAuthenticated}
			<div class="mt-8 rounded-3xl bg-base-200/70 p-6">
				<h2 class="text-2xl font-black">Sign in required</h2>
				<p class="mt-3 max-w-2xl text-base-content/75">
					Log in as <span class="font-semibold">ctw@ctwhome.com</span> to manage users.
				</p>
				<a class="btn btn-primary mt-5" href="{base}/">Return home</a>
			</div>
		{:else if !authStore.isAdmin}
			<div class="mt-8 rounded-3xl border border-error/25 bg-error/10 p-6 text-error">
				<h2 class="text-2xl font-black">Access denied</h2>
				<p class="mt-3">
					This page is only available to <span class="font-semibold">ctw@ctwhome.com</span>.
				</p>
			</div>
		{:else}
			{#if error}
				<div class="alert alert-error mt-8">{error}</div>
			{/if}

			{#if success}
				<div class="alert alert-success mt-8">{success}</div>
			{/if}

			{#if isLoading}
				<div class="mt-8 rounded-3xl bg-base-200/70 p-6">Loading users...</div>
			{:else}
				<div class="mt-8 overflow-x-auto rounded-3xl border border-base-300/70">
					<table class="table">
						<thead>
							<tr>
								<th>User</th>
								<th>Status</th>
								<th>Created</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user (user.id)}
								<tr>
									<td class="min-w-72">
										<div class="flex items-center gap-3">
											<div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black text-primary-content">
												{user.email.charAt(0).toUpperCase()}
											</div>
											<div class="min-w-0">
												<input
													class="input input-sm input-bordered w-full max-w-xs"
													value={user.name || ''}
													placeholder="Name"
													disabled={savingUserId === user.id}
													onchange={(event) => updateUser(user, { name: event.currentTarget.value })}
												/>
												<p class="mt-1 break-all text-sm text-base-content/70">{user.email}</p>
												{#if isAdminEmail(user.email)}
													<span class="badge badge-primary mt-2">Admin</span>
												{/if}
											</div>
										</div>
									</td>
									<td>
										<label class="label w-fit cursor-pointer gap-3">
											<input
												type="checkbox"
												class="toggle toggle-primary"
												checked={user.verified}
												disabled={savingUserId === user.id}
												onchange={(event) => updateUser(user, { verified: event.currentTarget.checked })}
											/>
											<span>{user.verified ? 'Verified' : 'Not verified'}</span>
										</label>
									</td>
									<td class="whitespace-nowrap text-base-content/70">{formatDate(user.created)}</td>
									<td class="text-right">
										<button
											class="btn btn-error btn-sm"
											type="button"
											disabled={savingUserId === user.id || isAdminEmail(user.email)}
											onclick={() => deleteUser(user)}
										>
											Delete
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</section>
</main>
