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

	async function updatePosition() {
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
		cleanupFloating?.();
		cleanupFloating = undefined;
		open = !open;

		if (!open) return;
		await updatePosition();
		if (button && menu) cleanupFloating = autoUpdate(button, menu, updatePosition);
	}

	function closeMenu() {
		cleanupFloating?.();
		cleanupFloating = undefined;
		open = false;
	}

	function handleDocumentClick(event: MouseEvent) {
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
		class="btn w-full justify-between btn-outline"
		type="button"
		aria-expanded={open}
		onclick={toggleMenu}
	>
		<span>{label}</span>
		<span class="badge badge-primary">{selected.length || options.length}</span>
	</button>

	{#if open}
		<div
			bind:this={menu}
			class="z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
			style={menuStyle}
			role="menu"
		>
			<input
				class="input-bordered input input-sm mb-2 w-full"
				type="search"
				bind:value={query}
				{placeholder}
				aria-label={placeholder}
			/>
			<div class="max-h-64 overflow-y-auto">
				{#each visibleOptions as option}
					<label
						class="label flex cursor-pointer justify-between gap-3 rounded-lg px-2 hover:bg-base-200"
					>
						<span class="flex min-w-0 items-center gap-3">
							<input
								class="checkbox checkbox-sm checkbox-primary"
								type="checkbox"
								checked={selected.includes(option.value)}
								onchange={() => onToggle(option.value)}
							/>
							<span class="label-text truncate whitespace-nowrap">{option.label}</span>
						</span>
						<span class="badge badge-ghost badge-sm">{option.count}</span>
					</label>
				{/each}

				{#if visibleOptions.length === 0}
					<div class="px-2 py-3 text-sm text-base-content/60">No matching options.</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
