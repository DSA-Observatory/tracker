<script lang="ts" context="module">
	export type FilterOption = {
		value: string;
		label: string;
		count: number;
	};
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

	export let label: string;
	export let options: FilterOption[] = [];
	export let selected: string[] = [];
	export let placeholder = 'Search options';
	export let variant: 'dropdown' | 'collapsible' = 'dropdown';
	export let onToggle: (value: string) => void = () => {};

	let open = false;
	let query = '';
	let button: HTMLElement;
	let menu: HTMLElement;
	let menuStyle = '';
	let cleanupFloating: (() => void) | undefined;

	$: visibleOptions = options.filter((option) =>
		option.label.toLowerCase().includes(query.trim().toLowerCase())
	);
	$: availableOptionCount = options.filter((option) => option.count > 0).length;
	$: buttonCount = selected.length || availableOptionCount;

	async function updatePosition() {
		if (variant !== 'dropdown') return;
		await tick();
		if (!button || !menu) return;

		const { x, y } = await computePosition(button, menu, {
			placement: 'bottom-start',
			middleware: [offset(8), flip(), shift({ padding: 16 })],
			strategy: 'fixed'
		});

		menuStyle = `position: fixed; left: ${x}px; top: ${y}px; width: ${Math.min(Math.max(button.offsetWidth, 320), window.innerWidth - 32)}px;`;
	}

	async function toggleMenu() {
		if (variant === 'dropdown') {
			cleanupFloating?.();
			cleanupFloating = undefined;
		}
		open = !open;

		if (!open || variant !== 'dropdown') return;
		await updatePosition();
		if (button && menu) cleanupFloating = autoUpdate(button, menu, updatePosition);
	}

	function closeMenu() {
		cleanupFloating?.();
		cleanupFloating = undefined;
		open = false;
	}

	function handleDocumentClick(event: MouseEvent) {
		if (variant !== 'dropdown') return;
		const target = event.target as Node;
		if (button?.contains(target) || menu?.contains(target)) return;
		closeMenu();
	}

	function handleDocumentKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeMenu();
	}

	onMount(() => {
		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('keydown', handleDocumentKeydown);

		return () => {
			document.removeEventListener('click', handleDocumentClick);
			document.removeEventListener('keydown', handleDocumentKeydown);
			cleanupFloating?.();
		};
	});
</script>

<div class="w-full">
	<button
		bind:this={button}
		class={`flex h-9 w-full items-center justify-between gap-3 border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-950/10 focus-visible:outline-none ${variant === 'collapsible' && open ? 'rounded-t-md' : 'rounded-md'}`}
		type="button"
		aria-expanded={open}
		onclick={toggleMenu}
	>
		<span class="truncate">{label}</span>
		<span class="flex items-center gap-2">
			<span
				class={selected.length
					? 'rounded-full bg-slate-950 px-2 py-0.5 text-xs font-semibold text-white'
					: 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500'}
			>
				{buttonCount}
			</span>
			{#if variant === 'collapsible'}
				<span
					class={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
					aria-hidden="true"
				>
					v
				</span>
			{/if}
		</span>
	</button>

	{#if open && variant === 'dropdown'}
		<div
			bind:this={menu}
			class="z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
			style={menuStyle}
			role="menu"
		>
			<input
				class="mb-2 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 transition outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-950/10"
				type="search"
				bind:value={query}
				{placeholder}
				aria-label={placeholder}
			/>
			<div class="max-h-64 overflow-y-auto">
				{#each visibleOptions as option (option.value)}
					<label
						class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
					>
						<span class="flex min-w-0 items-center gap-2">
							<input
								class="size-4 rounded border-slate-300 text-slate-950 accent-slate-950"
								type="checkbox"
								checked={selected.includes(option.value)}
								onchange={() => onToggle(option.value)}
							/>
							<span class="truncate whitespace-nowrap text-slate-700">{option.label}</span>
						</span>
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
							{option.count}
						</span>
					</label>
				{/each}

				{#if visibleOptions.length === 0}
					<div class="px-2 py-3 text-sm text-slate-500">No matching options.</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if open && variant === 'collapsible'}
		<div
			class="rounded-b-md border border-t-0 border-slate-200 bg-white p-2 shadow-xs"
			role="region"
			aria-label={`${label} filters`}
		>
			<input
				class="mb-2 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 transition outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-950/10"
				type="search"
				bind:value={query}
				{placeholder}
				aria-label={placeholder}
			/>
			<div class="max-h-56 overflow-y-auto pr-1">
				{#each visibleOptions as option (option.value)}
					<label
						class="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
					>
						<span class="flex min-w-0 items-center gap-2">
							<input
								class="size-4 rounded border-slate-300 text-slate-950 accent-slate-950"
								type="checkbox"
								checked={selected.includes(option.value)}
								onchange={() => onToggle(option.value)}
							/>
							<span class="truncate text-slate-700">{option.label}</span>
						</span>
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
							{option.count}
						</span>
					</label>
				{/each}

				{#if visibleOptions.length === 0}
					<div class="px-2 py-3 text-sm text-slate-500">No matching options.</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
