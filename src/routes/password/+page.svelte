<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authStore, pb } from '$lib/database';
	import { getAuthFailure, type AuthFailure } from '$lib/auth-errors';
	import AuthErrorAlert from '$lib/components/ui/AuthErrorAlert.svelte';

	let password = $state('');
	let passwordConfirm = $state('');
	let error = $state<AuthFailure | null>(null);
	let success = $state('');
	let isSubmitting = $state(false);
	let email = $state('');
	let recoveryError = $state<AuthFailure | null>(null);
	let recoveryMessage = $state('');
	let isRequesting = $state(false);

	const token = $derived(page.url.searchParams.get('token') || '');
	const invitation = $derived(new URLSearchParams(page.url.hash.slice(1)).get('invite') || '');
	const hasLink = $derived(Boolean(token || invitation));
	const incompleteLink = $derived(
		!hasLink &&
			(page.url.searchParams.has('token') ||
				new URLSearchParams(page.url.hash.slice(1)).has('invite'))
	);

	async function submitPassword() {
		if (isSubmitting || success) return;
		if (!hasLink) {
			error = getAuthFailure(
				'This link is incomplete. Ask an administrator for help.',
				'Set password'
			);
			return;
		}

		if (password.length < 8) {
			error = getAuthFailure('Password must be at least 8 characters.', 'Set password');
			return;
		}

		if (password !== passwordConfirm) {
			error = getAuthFailure('Passwords do not match.', 'Set password');
			return;
		}

		isSubmitting = true;
		error = null;
		success = '';

		try {
			if (invitation) {
				await pb.send('/api/account/setup', {
					method: 'POST',
					body: { invitation, password, passwordConfirm }
				});
			} else {
				await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
			}
			// Password changes invalidate old sessions; require a fresh sign-in.
			authStore.logout();
			success = 'Your password has been set. You can now sign in.';
			password = '';
			passwordConfirm = '';
		} catch (err) {
			error = getAuthFailure(err, invitation ? 'Accept invitation' : 'Reset password');
		} finally {
			isSubmitting = false;
		}
	}

	async function requestRecovery() {
		if (isRequesting) return;
		isRequesting = true;
		recoveryError = null;
		recoveryMessage = '';
		try {
			await pb.collection('users').requestPasswordReset(email.trim().toLowerCase());
			recoveryMessage =
				'If an account exists for that email, a password-reset email has been requested. Check your inbox and spam folder and open the newest email promptly.';
		} catch (err) {
			recoveryError = getAuthFailure(err, 'Request password reset');
		} finally {
			isRequesting = false;
		}
	}
</script>

<svelte:head>
	<title>Set Password | DSA Case Law Tracker</title>
	<meta name="description" content="Set your DSA Case Law Tracker account password." />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12">
	<section class="w-full max-w-md rounded-3xl border border-base-300/70 bg-base-100 p-8 shadow-lg">
		<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Account access</p>
		<h1 class="mt-3 text-3xl font-black">{hasLink ? 'Set your password' : 'Recover access'}</h1>
		<p class="mt-3 text-base-content/70">
			{hasLink
				? 'Choose a password for your DSA Case Law Tracker account. After this, you can sign in.'
				: 'Request a password-reset email for your existing account.'}
		</p>

		{#if error}
			<div class="mt-6"><AuthErrorAlert failure={error} /></div>
		{:else if incompleteLink}
			<div class="mt-6">
				<AuthErrorAlert
					failure={getAuthFailure(
						'This link is missing its security token. Ask an administrator to resend it.',
						'Open password link'
					)}
				/>
			</div>
		{/if}

		{#if success}
			<div class="mt-6 alert text-sm alert-success" role="status">{success}</div>
			<a class="btn mt-4 w-full btn-primary" href={resolve('/')}>Continue to sign in</a>
		{/if}

		{#if hasLink && !success}
			<form
				class="mt-6 space-y-4"
				onsubmit={(event) => {
					event.preventDefault();
					submitPassword();
				}}
			>
				<div>
					<label class="label" for="setup-password">
						<span class="label-text font-semibold">Password</span>
					</label>
					<input
						id="setup-password"
						class="input-bordered input w-full"
						type="password"
						bind:value={password}
						minlength="8"
						maxlength="255"
						autocomplete="new-password"
						disabled={isSubmitting}
						required
					/>
					<p class="mt-1 text-xs text-base-content/50">At least 8 characters.</p>
				</div>

				<div>
					<label class="label" for="setup-password-confirm">
						<span class="label-text font-semibold">Confirm password</span>
					</label>
					<input
						id="setup-password-confirm"
						class="input-bordered input w-full"
						type="password"
						bind:value={passwordConfirm}
						minlength="8"
						maxlength="255"
						autocomplete="new-password"
						disabled={isSubmitting}
						required
					/>
				</div>

				<button
					class="btn w-full btn-primary"
					type="submit"
					disabled={isSubmitting}
					aria-busy={isSubmitting}
				>
					{isSubmitting ? 'Setting password...' : 'Set password'}
				</button>
			</form>
		{/if}

		{#if !success && (!hasLink || error)}
			<form
				class="mt-6 space-y-3 border-t border-base-300 pt-5"
				onsubmit={(event) => {
					event.preventDefault();
					requestRecovery();
				}}
			>
				<label class="label" for="recovery-email"
					><span class="label-text font-semibold">Account email</span></label
				>
				<input
					id="recovery-email"
					class="input-bordered input w-full"
					type="email"
					autocomplete="email"
					bind:value={email}
					required
					disabled={isRequesting}
				/>
				<button
					class="btn w-full btn-outline"
					type="submit"
					disabled={isRequesting}
					aria-busy={isRequesting}
				>
					{isRequesting ? 'Requesting...' : 'Request password reset'}
				</button>
				<p class="text-xs text-base-content/60">
					Invitation and admin-issued recovery links do not expire. Self-service password-reset
					links expire for security; request another here if needed.
				</p>
				{#if recoveryError}<AuthErrorAlert failure={recoveryError} />{/if}
				{#if recoveryMessage}<p class="text-sm" role="status">{recoveryMessage}</p>{/if}
			</form>
		{/if}

		<a class="btn mt-4 w-full btn-ghost" href={resolve('/')}>Return to login</a>
	</section>
</main>
