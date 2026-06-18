<script lang="ts">
	import { base } from '$app/paths';
	import { authStore, pb } from '$lib/database';
	import { isAdminEmail, isAdminUser } from '$lib/admin';

	type ManagedUser = {
		id: string;
		email: string;
		name?: string;
		username?: string;
		is_admin?: boolean;
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
	let inviteName = $state('');
	let inviteEmail = $state('');
	let isInviting = $state(false);
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
			await refreshAdminSession();
			users = await pb.collection('users').getFullList<ManagedUser>({
				sort: '-created'
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load users.';
		} finally {
			isLoading = false;
		}
	}

	function createTemporaryPassword() {
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const bytes = new Uint8Array(24);
		crypto.getRandomValues(bytes);

		return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
	}

	async function refreshAdminSession() {
		if (!pb.authStore.isValid) {
			throw new Error('Your admin session expired. Sign in again to manage users.');
		}

		await pb.collection('users').authRefresh();
	}

	async function inviteUser() {
		const name = inviteName.trim();
		const email = inviteEmail.trim().toLowerCase();

		if (!name || !email) {
			error = 'Enter a name and email address.';
			success = '';
			return;
		}

		isInviting = true;
		error = '';
		success = '';

		try {
			await refreshAdminSession();

			const password = createTemporaryPassword();
			const user = await pb.collection('users').create<ManagedUser>({
				email,
				name,
				is_admin: false,
				password,
				passwordConfirm: password,
				emailVisibility: true
			});

			users = [user, ...users];
			inviteName = '';
			inviteEmail = '';

			try {
				await pb.collection('users').requestPasswordReset(email);
			} catch (mailErr) {
				error =
					mailErr instanceof Error
						? `Created ${user.email}, but could not send the setup email: ${mailErr.message}`
						: `Created ${user.email}, but could not send the setup email.`;
				return;
			}

			success = `Invited ${user.email}. A setup email was sent with an app password link.`;
		} catch (err) {
			error = err instanceof Error ? err.message : `Could not invite ${email}.`;
		} finally {
			isInviting = false;
		}
	}

	async function updateUser(user: ManagedUser, changes: Partial<ManagedUser>) {
		savingUserId = user.id;
		error = '';
		success = '';

		try {
			await refreshAdminSession();

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
			await refreshAdminSession();

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
	<section
		class="rounded-[2rem] border border-base-300/60 bg-base-100 p-6 shadow-lg shadow-black/5 sm:p-8"
	>
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
				<a class="btn mt-5 btn-primary" href="{base}/">Return home</a>
			</div>
		{:else if !authStore.isAdmin}
			<div class="mt-8 rounded-3xl border border-error/25 bg-error/10 p-6 text-error">
				<h2 class="text-2xl font-black">Access denied</h2>
				<p class="mt-3">This page is only available to administrators.</p>
			</div>
		{:else}
			{#if error}
				<div class="mt-8 alert alert-error">{error}</div>
			{/if}

			{#if success}
				<div class="mt-8 alert alert-success">{success}</div>
			{/if}

			<form
				class="mt-8 rounded-3xl border border-base-300/70 bg-base-200/50 p-5"
				onsubmit={(event) => {
					event.preventDefault();
					inviteUser();
				}}
			>
				<div class="flex flex-col gap-4 lg:flex-row lg:items-end">
					<div class="flex-1">
						<label class="label" for="invite-name">
							<span class="label-text font-semibold">Name</span>
						</label>
						<input
							id="invite-name"
							class="input-bordered input w-full"
							bind:value={inviteName}
							placeholder="Jane Doe"
							autocomplete="name"
							disabled={isInviting}
							required
						/>
					</div>
					<div class="flex-1">
						<label class="label" for="invite-email">
							<span class="label-text font-semibold">Email</span>
						</label>
						<input
							id="invite-email"
							class="input-bordered input w-full"
							bind:value={inviteEmail}
							type="email"
							placeholder="jane@example.com"
							autocomplete="email"
							disabled={isInviting}
							required
						/>
					</div>
					<button class="btn btn-primary" type="submit" disabled={isInviting}>
						{isInviting ? 'Sending...' : 'Invite user'}
					</button>
				</div>
				<p class="mt-3 text-sm text-base-content/60">
					The user will receive a secure link to set their password at {base}/password.
				</p>
			</form>

			{#if isLoading}
				<div class="mt-8 rounded-3xl bg-base-200/70 p-6">Loading users...</div>
			{:else}
				<div class="mt-8 overflow-x-auto rounded-3xl border border-base-300/70">
					<table class="table">
						<thead>
							<tr>
								<th>User</th>
								<th>Status</th>
								<th>Role</th>
								<th>Created</th>
								<th class="text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user (user.id)}
								<tr>
									<td class="min-w-72">
										<div class="flex items-center gap-3">
											<div
												class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black text-primary-content"
											>
												{user.email.charAt(0).toUpperCase()}
											</div>
											<div class="min-w-0">
												<input
													class="input-bordered input input-sm w-full max-w-xs"
													value={user.name || ''}
													placeholder="Name"
													disabled={savingUserId === user.id}
													onchange={(event) =>
														updateUser(user, { name: event.currentTarget.value })}
												/>
												<p class="mt-1 text-sm break-all text-base-content/70">{user.email}</p>
												{#if isAdminUser(user)}
													<span class="mt-2 badge badge-primary">Admin</span>
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
												onchange={(event) =>
													updateUser(user, { verified: event.currentTarget.checked })}
											/>
											<span>{user.verified ? 'Verified' : 'Not verified'}</span>
										</label>
									</td>
									<td>
										<label class="label w-fit cursor-pointer gap-3">
											<input
												type="checkbox"
												class="toggle toggle-primary"
												checked={isAdminUser(user)}
												disabled={savingUserId === user.id || isAdminEmail(user.email)}
												onchange={(event) =>
													updateUser(user, { is_admin: event.currentTarget.checked })}
											/>
											<span>{isAdminUser(user) ? 'Admin' : 'User'}</span>
										</label>
									</td>
									<td class="whitespace-nowrap text-base-content/70">{formatDate(user.created)}</td>
									<td class="text-right">
										<button
											class="btn btn-sm btn-error"
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
