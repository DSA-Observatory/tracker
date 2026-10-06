<script lang="ts">
	import { authStore } from '$lib/database';
	import { resolve } from '$app/paths';
	import LoginForm from './LoginForm.svelte';
	let loginOpen = $state(false);
</script>

<div>
	<!-- Logged in -->
	{#if authStore.isAuthenticated}
		<div class="dropdown dropdown-end">
			<button
				type="button"
				aria-haspopup="true"
				aria-expanded="false"
				class="flex h-12 w-12 items-center justify-center rounded-full transition hover:bg-base-200 active:scale-95"
			>
				<div
					class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white ring-primary ring-offset-2 ring-offset-base-100"
				>
					{authStore.user?.email?.charAt(0).toUpperCase() || 'U'}
				</div>
			</button>
			<ul class="dropdown-content menu z-10 w-52 rounded-box bg-base-100 p-2 shadow-lg" role="menu">
				<li class="menu-title px-4 py-2">
					<span class="text-xs text-base-content/70">{authStore.user?.email}</span>
				</li>
				<div class="divider my-0"></div>
				<li>
					<a href={resolve('/profile')} class="flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						Profile
					</a>
				</li>
				{#if authStore.isAdmin}
					<li>
						<a href={resolve('/admin')} class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="size-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-4a4 4 0 100-8 4 4 0 000 8zM9 10a4 4 0 100-8 4 4 0 000 8z"
								/>
							</svg>
							Admin
						</a>
					</li>
				{/if}
			</ul>
		</div>
		<!-- Not logged in-->
	{:else}
		<div>
			<div>
				<button
					type="button"
					class="cursor-pointer whitespace-nowrap"
					onclick={() => (loginOpen = true)}>Login</button
				>
				<input id="login-modal" type="checkbox" class="modal-toggle" bind:checked={loginOpen} />
				<div class="modal h-screen">
					<div class="modal-box">
						<LoginForm />

						<div class="modal-action">
							<label for="login-modal" class="btn">Close</label>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
