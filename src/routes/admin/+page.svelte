<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import { authStore, pb } from '$lib/database';
	import { isAdminEmail, isAdminUser } from '$lib/admin';
	import { getAuthFailure, type AuthFailure } from '$lib/auth-errors';
	import AuthErrorAlert from '$lib/components/ui/AuthErrorAlert.svelte';

	type Invitation = {
		id: string;
		user: string;
		status: 'pending' | 'used' | 'revoked';
		purpose?: 'setup' | 'recovery';
	};
	type InvitationResult = { mailSent: boolean; mailError?: string };

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
	let invitations = $state<Invitation[]>([]);
	let isLoading = $state(true);
	let error = $state<AuthFailure | null>(null);
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
		error = null;

		try {
			await refreshAdminSession();
			users = await pb.collection('users').getFullList<ManagedUser>({
				sort: '-created'
			});
			const result = await pb.send<{ items: Invitation[] }>('/api/admin/invitations', {
				method: 'GET'
			});
			invitations = result.items;
		} catch (err) {
			error = getAuthFailure(err, 'Load users and invitations');
		} finally {
			isLoading = false;
		}
	}

	async function refreshAdminSession() {
		if (!pb.authStore.isValid) {
			authStore.logout();
			throw new Error('Your admin session expired. Sign in again to manage users.');
		}

		try {
			await pb.collection('users').authRefresh();
		} catch (err) {
			if (err instanceof Error && 'status' in err && err.status === 401) {
				authStore.logout();
				throw new Error('Your admin session expired. Sign in again to manage users.');
			}
			throw err;
		}
	}

	async function inviteUser() {
		const name = inviteName.trim();
		const email = inviteEmail.trim().toLowerCase();

		if (!name || !email) {
			error = getAuthFailure('Enter a name and email address.', 'Invite user');
			success = '';
			return;
		}

		isInviting = true;
		error = null;
		success = '';

		try {
			await refreshAdminSession();

			const result = await pb.send<InvitationResult>('/api/admin/invitations', {
				method: 'POST',
				body: { email, name }
			});
			inviteName = '';
			inviteEmail = '';
			await loadUsers();
			if (!result.mailSent) {
				error = getAuthFailure(
					`Created ${email}, but the setup email could not be sent. Use Resend setup link to retry. ${result.mailError || ''}`,
					'Send invitation email'
				);
			} else {
				success = `Invited ${email}. The setup email was accepted for sending. The invitation has no time limit.`;
			}
		} catch (err) {
			error = getAuthFailure(err, 'Invite user');
		} finally {
			isInviting = false;
		}
	}

	async function manageInvitation(
		user: ManagedUser,
		invitation: Invitation,
		action: 'resend' | 'revoke'
	) {
		const kind = invitation.purpose === 'recovery' ? 'recovery' : 'setup';
		if (
			!confirm(
				action === 'resend'
					? `Send a new ${kind} link to ${user.email}? The previous link will stop working.`
					: `Revoke the ${kind} link for ${user.email}?`
			)
		)
			return;
		savingUserId = user.id;
		error = null;
		success = '';
		try {
			await refreshAdminSession();
			const result = await pb.send<InvitationResult>(
				`/api/admin/invitations/${encodeURIComponent(invitation.id)}/${action}`,
				{ method: 'POST' }
			);
			await loadUsers();
			if (action === 'resend' && !result.mailSent) {
				error = getAuthFailure(
					result.mailError || `The ${kind} email could not be sent. Retry Resend ${kind} link.`,
					`Resend ${kind} link`
				);
			} else {
				success =
					action === 'resend'
						? `A new ${kind} email for ${user.email} was accepted for sending. Use the newest email; the link has no time limit.`
						: `Revoked the ${kind} link for ${user.email}.`;
			}
		} catch (err) {
			error = getAuthFailure(
				err,
				action === 'resend' ? `Resend ${kind} link` : `Revoke ${kind} link`
			);
		} finally {
			savingUserId = '';
		}
	}

	async function sendRecoveryLink(user: ManagedUser) {
		if (
			!confirm(
				`Send a non-expiring recovery link to ${user.email}? It can reset their password until used or revoked. Their account ID and permissions will not change.`
			)
		)
			return;
		savingUserId = user.id;
		error = null;
		success = '';
		try {
			await refreshAdminSession();
			const result = await pb.send<InvitationResult>(
				`/api/admin/users/${encodeURIComponent(user.id)}/recovery-invitation`,
				{ method: 'POST' }
			);
			await loadUsers();
			if (!result.mailSent) {
				error = getAuthFailure(
					result.mailError ||
						'The recovery email could not be sent. Use Resend recovery link to retry.',
					'Send recovery link'
				);
			} else {
				success = `The recovery email for ${user.email} was accepted for sending. The link has no time limit until used or revoked. Their account and permissions are unchanged.`;
			}
		} catch (err) {
			error = getAuthFailure(err, 'Send recovery link');
		} finally {
			savingUserId = '';
		}
	}

	async function updateUser(user: ManagedUser, changes: Partial<ManagedUser>) {
		savingUserId = user.id;
		error = null;
		success = '';

		try {
			await refreshAdminSession();

			const updated = await pb.collection('users').update<ManagedUser>(user.id, changes);
			users = users.map((item) => (item.id === user.id ? updated : item));
			success = `Updated ${updated.email}.`;
		} catch (err) {
			error = getAuthFailure(err, 'Update user');
		} finally {
			savingUserId = '';
		}
	}

	async function updateUserVerified(user: ManagedUser, verified: boolean) {
		savingUserId = user.id;
		error = null;
		success = '';

		try {
			await refreshAdminSession();

			const updated = await pb.send<ManagedUser>(
				`/api/admin/users/${encodeURIComponent(user.id)}/verified`,
				{
					method: 'PATCH',
					body: { verified }
				}
			);
			users = users.map((item) => (item.id === user.id ? updated : item));
			success = `Updated ${updated.email}.`;
		} catch (err) {
			error = getAuthFailure(
				err instanceof Error && 'status' in err && err.status === 404
					? 'Verification is unavailable: the admin verification endpoint was not found on PocketBase. The backend hook must be installed before accounts can be verified here.'
					: err,
				'Update email verification'
			);
		} finally {
			savingUserId = '';
		}
	}

	async function deleteUser(user: ManagedUser) {
		if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return;

		savingUserId = user.id;
		error = null;
		success = '';

		try {
			await refreshAdminSession();

			await pb.collection('users').delete(user.id);
			users = users.filter((item) => item.id !== user.id);
			success = `Deleted ${user.email}.`;
		} catch (err) {
			error = getAuthFailure(err, 'Delete user');
		} finally {
			savingUserId = '';
		}
	}
</script>

<svelte:head>
	<title>Admin | DSA Case Law Tracker</title>
	<meta name="description" content="Manage DSA Case Law Tracker users." />
</svelte:head>

<AdminPanelLayout>
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
					Use Login in the header to sign in with your administrator account.
				</p>
				<a class="btn mt-5 btn-primary" href={resolve('/')}>Return home</a>
			</div>
		{:else if !authStore.isAdmin}
			<div class="mt-8 rounded-3xl border border-error/25 bg-error/10 p-6 text-error">
				<h2 class="text-2xl font-black">Access denied</h2>
				<p class="mt-3">This page is only available to administrators.</p>
			</div>
		{:else}
			{#if error}
				<div class="mt-8"><AuthErrorAlert failure={error} /></div>
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
					New users receive a single-use setup link with no time limit. For existing accounts, send
					a recovery link using the controls below; do not delete and recreate the account.
				</p>
			</form>

			{#if isLoading}
				<div class="mt-8 rounded-3xl bg-base-200/70 p-6">Loading users...</div>
			{:else}
				<div class="user-list mt-8 rounded-3xl border border-base-300/70">
					<div
						class="flex items-center justify-between gap-3 border-b border-base-300/60 px-5 py-4"
					>
						<h2 class="text-sm font-semibold">
							Team members <span
								class="ml-2 rounded-full bg-base-200 px-2 py-0.5 text-xs text-base-content/60"
								>{users.length}</span
							>
						</h2>
						<span class="text-xs text-base-content/50">Names are saved on change</span>
					</div>
					<ul class="divide-y divide-base-300/60">
						{#each users as user (user.id)}
							{@const invitation = invitations.find(
								(item) => item.user === user.id && item.status === 'pending'
							)}
							<li class="user-row p-5">
								<div class="flex min-w-0 items-start gap-3">
									<div
										class="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black text-primary-content"
									>
										{user.email.charAt(0).toUpperCase()}
									</div>
									<div class="min-w-0 flex-1">
										<input
											class="input input-sm w-full min-w-0 border-transparent bg-transparent px-0 font-semibold hover:border-base-300 focus:border-base-300 focus:px-2"
											aria-label={`Name for ${user.email}`}
											value={user.name || ''}
											placeholder="Name"
											disabled={savingUserId === user.id}
											onchange={(event) => updateUser(user, { name: event.currentTarget.value })}
										/>
										<p class="mt-1 text-sm break-all text-base-content/70">{user.email}</p>
										<p class="mt-2 text-xs text-base-content/45">
											Joined {formatDate(user.created)}
										</p>
									</div>
								</div>
								<div class="user-controls">
									<label
										class="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-base-200/50 px-3 py-2.5 text-sm"
									>
										<span class="flex flex-col gap-0.5"
											><span class="text-xs text-base-content/50">Email status</span><span
												class={user.verified ? 'font-medium' : 'font-medium text-warning'}
												>{user.verified ? 'Verified' : 'Unverified'}</span
											></span
										>
										<input
											type="checkbox"
											class="toggle shrink-0 toggle-primary toggle-sm"
											aria-label={`Verify ${user.email}`}
											checked={user.verified}
											disabled={savingUserId === user.id}
											onchange={async (event) => {
												const input = event.currentTarget;
												await updateUserVerified(user, input.checked);
												input.checked =
													users.find((item) => item.id === user.id)?.verified ?? user.verified;
											}}
										/>
									</label>
									<label
										class="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-base-200/50 px-3 py-2.5 text-sm"
									>
										<span class="flex flex-col gap-0.5"
											><span class="text-xs text-base-content/50">Access</span><span
												class="font-medium">{isAdminUser(user) ? 'Admin' : 'User'}</span
											></span
										>
										<input
											type="checkbox"
											class="toggle shrink-0 toggle-primary toggle-sm"
											aria-label={`Admin access for ${user.email}`}
											checked={isAdminUser(user)}
											disabled={savingUserId === user.id || isAdminEmail(user.email)}
											onchange={(event) =>
												updateUser(user, { is_admin: event.currentTarget.checked })}
										/>
									</label>
								</div>
								<div class="flex flex-col items-end gap-1">
									{#if invitation}
										<button
											class="btn btn-outline btn-sm"
											type="button"
											disabled={savingUserId === user.id}
											onclick={() => manageInvitation(user, invitation, 'resend')}
											>Resend {invitation.purpose === 'recovery' ? 'recovery' : 'setup'} link</button
										>
										<button
											class="btn btn-ghost btn-sm"
											type="button"
											disabled={savingUserId === user.id}
											onclick={() => manageInvitation(user, invitation, 'revoke')}
											>Revoke {invitation.purpose === 'recovery' ? 'recovery' : 'setup'} link</button
										>
									{:else}
										<button
											class="btn btn-outline btn-sm"
											type="button"
											disabled={savingUserId === user.id}
											onclick={() => sendRecoveryLink(user)}>Send recovery link</button
										>
									{/if}
									<button
										class="btn text-error btn-ghost btn-sm hover:bg-error/10"
										aria-label={`Delete ${user.email}`}
										type="button"
										disabled={savingUserId === user.id || isAdminEmail(user.email)}
										onclick={() => deleteUser(user)}
									>
										Delete
									</button>
								</div>
							</li>
						{:else}
							<li class="p-6 text-sm text-base-content/60">No team members yet.</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</section>
</AdminPanelLayout>

<style>
	.user-list {
		container-type: inline-size;
	}
	.user-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}
	.user-controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	@container (min-width: 680px) {
		.user-row {
			grid-template-columns: minmax(0, 1fr) 300px auto;
			align-items: center;
		}
	}
	@container (max-width: 340px) {
		.user-controls {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
