<script lang="ts">
	import PhKeyBold from '~icons/ph/key-bold';
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/database';
	import { getAuthFailure, type AuthFailure } from '$lib/auth-errors';
	import AuthErrorAlert from '../AuthErrorAlert.svelte';
	import { closeLoginModal, validateEmail } from './utils';

	let email = $state('');
	let password = $state('');
	let error = $state<AuthFailure | null>(null);
	let isLoading = $state(false);

	async function handleEmailSignIn() {
		error = null;
		isLoading = true;

		// Validate email
		const emailError = validateEmail(email);
		if (emailError) {
			error = getAuthFailure(emailError, 'Sign in');
			isLoading = false;
			return;
		}

		try {
			await authStore.login(email, password);

			// Close modal after successful login
			closeLoginModal();

			// Clear form
			email = '';
			password = '';
		} catch (e) {
			error = getAuthFailure(e, 'Sign in');
		} finally {
			isLoading = false;
		}
	}
</script>

<form
	class="rounded-box border border-base-300 p-3"
	onsubmit={(e) => {
		e.preventDefault();
		handleEmailSignIn();
	}}
	aria-label="Email login form"
>
	<div class="space-y-3">
		<div class="form-control-float">
			<input
				id="email"
				bind:value={email}
				type="email"
				placeholder=" "
				required
				autocomplete="email"
				disabled={isLoading}
				aria-invalid={error && !validateEmail(email) ? 'true' : undefined}
			/>
			<label for="email">Email</label>
		</div>

		<div class="form-control-float">
			<input
				id="password"
				bind:value={password}
				type="password"
				placeholder=" "
				required
				autocomplete="current-password"
				disabled={isLoading}
			/>
			<label for="password">Password</label>
		</div>

		{#if error}
			<AuthErrorAlert failure={error} />
		{/if}
		<a class="link text-sm link-primary" href={resolve('/password')} onclick={closeLoginModal}
			>Forgot your password?</a
		>

		<button
			type="submit"
			class="btn w-full btn-outline btn-secondary"
			disabled={isLoading}
			aria-busy={isLoading}
		>
			<PhKeyBold class="size-5" />
			{isLoading ? 'Signing in...' : 'Sign in with Email'}
		</button>
	</div>
</form>
