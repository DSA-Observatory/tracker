<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/database';

	function formatDate(value?: string) {
		if (!value) return 'Unknown';

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Profile | DSA Case Law Tracker</title>
	<meta name="description" content="Your DSA Case Law Tracker profile." />
</svelte:head>

<main class="container mx-auto max-w-4xl px-4 pb-16">
	<section
		class="rounded-[2rem] border border-base-300/60 bg-base-100 p-6 shadow-lg shadow-black/5 sm:p-8"
	>
		<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Account</p>
		<h1 class="mt-3 text-4xl font-black">Profile</h1>

		{#if authStore.isAuthenticated && authStore.user}
			<div class="mt-8 flex flex-col gap-6 md:flex-row md:items-start">
				<div
					class="grid size-20 shrink-0 place-items-center rounded-3xl bg-primary text-3xl font-black text-primary-content"
				>
					{authStore.user.email?.charAt(0).toUpperCase() || 'U'}
				</div>

				<div class="w-full space-y-5">
					<div>
						<p class="text-sm text-base-content/60">Email</p>
						<p class="text-xl font-bold break-all">{authStore.user.email}</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="rounded-2xl bg-base-200/70 p-4">
							<p class="text-sm text-base-content/60">Username</p>
							<p class="mt-1 font-semibold">{authStore.user.username || 'Not set'}</p>
						</div>
						<div class="rounded-2xl bg-base-200/70 p-4">
							<p class="text-sm text-base-content/60">Verification</p>
							<p class="mt-1 font-semibold">
								{authStore.user.verified ? 'Verified' : 'Not verified'}
							</p>
						</div>
						<div class="rounded-2xl bg-base-200/70 p-4">
							<p class="text-sm text-base-content/60">Created</p>
							<p class="mt-1 font-semibold">{formatDate(authStore.user.created)}</p>
						</div>
						<div class="rounded-2xl bg-base-200/70 p-4">
							<p class="text-sm text-base-content/60">Updated</p>
							<p class="mt-1 font-semibold">{formatDate(authStore.user.updated)}</p>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="mt-8 rounded-3xl bg-base-200/70 p-6">
				<h2 class="text-2xl font-black">Sign in to view your profile</h2>
				<p class="mt-3 max-w-2xl text-base-content/75">
					Your profile details are available after logging in with the account menu in the header.
				</p>
				<a class="btn mt-5 btn-primary" href={resolve('/')}>Return home</a>
			</div>
		{/if}
	</section>
</main>
