<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { SearchScope } from '$lib/components/cases/types';

	interface SearchScopeOption {
		value: SearchScope;
		label: string;
	}

	interface Props {
		value?: string;
		searchScope?: SearchScope;
		scopes?: SearchScopeOption[];
		placeholder?: string;
		navigateOnSubmit?: boolean;
		variant?: 'header' | 'hero';
	}

	let {
		value = $bindable(''),
		searchScope = $bindable<SearchScope>('all'),
		scopes = [],
		placeholder = 'Search cases',
		navigateOnSubmit = true,
		variant = 'header'
	}: Props = $props();

	function submitSearch() {
		const query = value.trim();
		if (!query || !navigateOnSubmit) return;

		goto(`${base}/cases?q=${encodeURIComponent(query)}`);
	}
</script>

<form
	class={variant === 'hero'
		? 'rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/60 backdrop-blur'
		: 'relative'}
	onsubmit={(event) => {
		event.preventDefault();
		submitSearch();
	}}
>
	<div class={variant === 'hero' ? 'grid gap-2 lg:grid-cols-[minmax(20rem,1fr)_13rem]' : ''}>
		<label
			class={variant === 'hero'
				? 'flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs transition focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/10'
				: 'input-bordered input flex items-center gap-2 opacity-80'}
		>
			{#if variant === 'hero'}
				<span class="text-slate-400" aria-hidden="true">Search</span>
			{:else}
				<svg class="h-5 w-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			{/if}
			<input
				type="search"
				{placeholder}
				class={variant === 'hero'
					? 'min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none'
					: 'grow'}
				aria-label="Search cases"
				bind:value
			/>
			{#if navigateOnSubmit}
				<button class="badge hidden badge-primary sm:inline-flex" type="submit">Go</button>
			{/if}
		</label>

		{#if scopes.length}
			<label
				class="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs transition hover:bg-slate-50 focus-within:ring-2 focus-within:ring-slate-950/10"
			>
				<span class="shrink-0 text-slate-400">Search in</span>
				<select
					class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none"
					bind:value={searchScope}
					aria-label="Search scope"
				>
					{#each scopes as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>
</form>
