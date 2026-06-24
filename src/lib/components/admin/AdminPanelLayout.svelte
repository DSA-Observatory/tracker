<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	const panels = [
		{
			title: 'Users',
			description: 'Manage editors and admins',
			path: '/admin'
		},
		{
			title: 'Suggested cases',
			description: 'Review submitted case leads',
			path: '/admin/submissions'
		}
	] as const;

	function isActive(path: (typeof panels)[number]['path']) {
		return page.url.pathname === resolve(path);
	}
</script>

<main class="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
	<aside class="lg:sticky lg:top-24 lg:self-start">
		<div class="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
			<p class="px-2 text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">Admin</p>
			<nav class="mt-4 grid gap-2" aria-label="Admin panels">
				{#each panels as panel}
					<a
						href={resolve(panel.path)}
						class={isActive(panel.path)
							? 'rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-sm'
							: 'rounded-2xl px-4 py-3 text-slate-700 transition hover:bg-slate-100'}
					>
						<span class="block font-semibold">{panel.title}</span>
						<span
							class={isActive(panel.path)
								? 'mt-1 block text-sm text-white/70'
								: 'mt-1 block text-sm text-slate-500'}
						>
							{panel.description}
						</span>
					</a>
				{/each}
			</nav>
		</div>
	</aside>

	<div class="min-w-0">
		{@render children()}
	</div>
</main>
