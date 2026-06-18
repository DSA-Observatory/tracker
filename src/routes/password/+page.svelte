<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pb } from '$lib/database';

	let password = $state('');
	let passwordConfirm = $state('');
	let error = $state('');
	let success = $state('');
	let isSubmitting = $state(false);

	const token = $derived(page.url.searchParams.get('token') || '');

	async function submitPassword() {
		if (!token) {
			error = 'This password setup link is missing its token. Ask an admin for a new invitation.';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}

		if (password !== passwordConfirm) {
			error = 'Passwords do not match.';
			return;
		}

		isSubmitting = true;
		error = '';
		success = '';

		try {
			await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm);
			success = 'Your password has been set. You can now sign in.';
			password = '';
			passwordConfirm = '';

			setTimeout(() => {
				goto(`${base}/`);
			}, 1200);
		} catch (err) {
			error =
				err instanceof Error
					? err.message
					: 'Could not set your password. The link may have expired or already been used.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Set Password | DSA Case Law Tracker</title>
	<meta name="description" content="Set your DSA Case Law Tracker account password." />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-base-200 px-4 py-12">
	<section class="w-full max-w-md rounded-3xl border border-base-300/70 bg-base-100 p-8 shadow-lg">
		<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Account setup</p>
		<h1 class="mt-3 text-3xl font-black">Set your password</h1>
		<p class="mt-3 text-base-content/70">
			Choose a password for your DSA Case Law Tracker account. After this, you can sign in from the
			main application.
		</p>

		{#if !token}
			<div class="mt-6 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm text-error">
				This password setup link is missing its token. Ask an admin for a new invitation.
			</div>
		{/if}

		{#if error}
			<div class="mt-6 alert text-sm alert-error">{error}</div>
		{/if}

		{#if success}
			<div class="mt-6 alert text-sm alert-success">{success}</div>
		{/if}

		<form
			class="mt-6 space-y-4"
			onsubmit={(event) => {
				event.preventDefault();
				submitPassword();
			}}
		>
			<div>
				<label class="label" for="password">
					<span class="label-text font-semibold">Password</span>
				</label>
				<input
					id="password"
					class="input-bordered input w-full"
					type="password"
					bind:value={password}
					minlength="8"
					autocomplete="new-password"
					disabled={isSubmitting || !token}
					required
				/>
				<p class="mt-1 text-xs text-base-content/50">At least 8 characters.</p>
			</div>

			<div>
				<label class="label" for="password-confirm">
					<span class="label-text font-semibold">Confirm password</span>
				</label>
				<input
					id="password-confirm"
					class="input-bordered input w-full"
					type="password"
					bind:value={passwordConfirm}
					minlength="8"
					autocomplete="new-password"
					disabled={isSubmitting || !token}
					required
				/>
			</div>

			<button class="btn w-full btn-primary" type="submit" disabled={isSubmitting || !token}>
				{isSubmitting ? 'Setting password...' : 'Set password'}
			</button>
		</form>

		<a class="btn mt-4 w-full btn-ghost" href="{base}/">Return to login</a>
	</section>
</main>
