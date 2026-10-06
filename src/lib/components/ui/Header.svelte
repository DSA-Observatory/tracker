<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import Login from '$lib/components/ui/Login/LoginButton.svelte';
	import Search from '$lib/components/Search.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { toggleMenu } from '$lib/stores/menu.store';
	import IconamoonMenuBurgerHorizontalBold from '~icons/iconamoon/menu-burger-horizontal-bold';
	import IconSearch from '~icons/lucide/search';
	import IconCommand from '~icons/lucide/command';
	import IconX from '~icons/lucide/x';
	import menuItems from '$lib/models/menu-itmes';
	import { onMount, tick } from 'svelte';

	interface Props {
		showSearch?: boolean;
	}

	let { showSearch = true }: Props = $props();
	let desktopSearch = $state<{ focus: () => void }>();
	let mobileSearch = $state<{ focus: () => void }>();
	let mobileSearchOpen = $state(false);
	let mobileSearchTrigger = $state<HTMLButtonElement>();
	let shortcutLabel = $state('⌘K');
	let desktopSearchValue = $state('');

	function isActive(path: (typeof menuItems)[number]['path']) {
		const resolvedPath = resolve(path);
		return page.url.pathname === resolvedPath || page.url.pathname.startsWith(`${resolvedPath}/`);
	}

	async function openSearch() {
		if (!showSearch) return;
		if (window.innerWidth >= 640) desktopSearch?.focus();
		else {
			mobileSearchOpen = true;
			await tick();
			mobileSearch?.focus();
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && mobileSearchOpen) {
			mobileSearchOpen = false;
			mobileSearchTrigger?.focus();
			return;
		}
		if (
			!showSearch ||
			event.isComposing ||
			event.repeat ||
			event.altKey ||
			!(event.metaKey || event.ctrlKey) ||
			event.key.toLowerCase() !== 'k'
		)
			return;

		event.preventDefault();
		void openSearch();
	}

	onMount(() => {
		shortcutLabel = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
	});

	afterNavigate(() => (mobileSearchOpen = false));
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<nav class="bien-nav mb-4 sm:mb-10">
	<div class="bien-glass"></div>
	<div class="bien-glass-edge"></div>
	<div class="relative mx-auto w-full max-w-[1680px] px-4 py-3 sm:px-6 lg:px-8">
		<!--Desktop Header-->
		<header class="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-4">
			<button
				class="rounded-md p-2 transition-colors duration-200 hover:bg-base-200 sm:hidden"
				onclick={toggleMenu}
				aria-label="Open menu"
			>
				<IconamoonMenuBurgerHorizontalBold class="size-6" />
			</button>
			<a
				class="no-drag mr-1 flex flex-initial shrink-0 items-center gap-2 select-none sm:mr-2 sm:gap-2.5"
				href={resolve('/')}
				aria-label="Case tracker home"
			>
				<span
					class="logo-mark grid size-9 place-items-center rounded-lg bg-primary text-xs font-black tracking-tight text-primary-content shadow-sm ring-1 ring-black/10 sm:size-10 sm:text-sm"
					aria-hidden="true"
				>
					DSA
				</span>
				<span
					class="max-w-[9.5rem] text-sm leading-none font-black tracking-[-0.035em] sm:max-w-none sm:text-base"
				>
					Case Tracker
				</span>
			</a>

			{#if showSearch}
				<div class="relative hidden w-[clamp(12rem,20vw,16.25rem)] min-w-0 sm:ml-4 sm:block [&_input]:pr-12 [&_input]:text-xs [&_input]:placeholder:text-gray-500 [&_input:focus]:outline-none [&_input:focus]:ring-0 [&_label]:rounded-lg [&_label]:border-neutral-300 [&_label]:bg-white [&_label]:shadow-none [&_label>svg]:text-neutral-500">
					<Search bind:this={desktopSearch} bind:value={desktopSearchValue} placeholder="Search cases…" variant="hero" showLabel={false} bare={true} />
					{#if !desktopSearchValue}
						<kbd class="pointer-events-none absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-slate-300/60 bg-slate-50/80 px-1.5 py-1 text-[11px] leading-none font-medium text-slate-600">{#if shortcutLabel === '⌘K'}<IconCommand class="size-3" aria-hidden="true" /><span class="sr-only">Command</span><span>K</span>{:else}{shortcutLabel}{/if}</kbd>
					{/if}
				</div>
				<button
					bind:this={mobileSearchTrigger}
					class="ml-auto grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none sm:hidden"
					type="button"
					onclick={() => openSearch()}
					aria-label="Search cases"
					aria-expanded={mobileSearchOpen}
				>
					<IconSearch class="size-5" aria-hidden="true" />
				</button>
			{/if}

			<div class="z-10 ml-auto hidden shrink-0 items-center gap-6 sm:flex lg:gap-9">
				{#each menuItems.filter((link) => link.title !== 'Submit') as link}
					<a
						class:active-nav-link={isActive(link.path)}
						class="menu-link relative py-2 text-sm font-semibold whitespace-nowrap text-slate-600 transition hover:text-slate-950"
						href={resolve(link.path)}
						aria-current={isActive(link.path) ? 'page' : undefined}
					>
						{link.displayTitle}
					</a>
				{/each}
			</div>

			<div class:ml-auto={!showSearch} class="shrink-0 sm:ml-2 lg:ml-3">
				<Login />
			</div>
			<a
				class="btn btn-primary hidden h-10 min-h-0 rounded-lg px-4 text-sm font-semibold whitespace-nowrap text-black md:ml-2 md:inline-flex lg:ml-3"
				href={resolve('/submit')}
			>
				Suggest a Case
			</a>
		</header>
		{#if showSearch && mobileSearchOpen}
			<div class="relative mt-2 flex items-start gap-2 pb-2 sm:hidden">
				<div class="min-w-0 flex-1"><Search bind:this={mobileSearch} placeholder="Search cases…" variant="hero" showLabel={false} bare={true} /></div>
				<button class="grid size-10 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100" type="button" aria-label="Close search" onclick={() => { mobileSearchOpen = false; mobileSearchTrigger?.focus(); }}><IconX class="size-4" /></button>
			</div>
		{/if}
	</div>
</nav>


<style>
	.logo-mark {
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.38),
			0 8px 18px rgb(0 0 0 / 0.12);
	}

	.active-nav-link {
		color: rgb(15 23 42);
	}

	.active-nav-link::after {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		height: 2px;
		border-radius: 9999px;
		background: rgb(245 158 11);
		content: '';
	}

	/* Frosted navigation header */
	nav {
		z-index: 10000;
		position: sticky;
		left: 0;
		right: 0;
		top: 0;
		/* height: 100px; */
	}

	/* Frosted Navigation bar */
	.bien-glass {
		position: absolute;
		inset: 0;
		/*   Extend the backdrop to the bottom for it to "collect the light" outside of the nav */
		--extended-by: 100px;
		bottom: calc(-1 * var(--extended-by));

		--filter: blur(30px);
		-webkit-backdrop-filter: var(--filter);
		backdrop-filter: var(--filter);
		pointer-events: none;

		/*   Cut the part of the backdrop that falls outside of <nav /> */
		--cutoff: calc(100% - var(--extended-by));
		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0,
			black var(--cutoff),
			transparent var(--cutoff)
		);
	}

	.bien-glass-edge {
		position: absolute;
		z-index: -1;
		left: 0;
		right: 0;

		--extended-by: 80px;
		--offset: 20px;
		--thickness: 2px;
		height: calc(var(--extended-by) + var(--offset));
		/*   Offset is used to snuck the border backdrop slightly under the main backdrop for  smoother effect */
		top: calc(100% - var(--offset) + var(--thickness));

		/*   Make the blur bigger so that the light bleed effect spreads wider than blur on the first backdrop */
		/*   Increase saturation and brightness to fake smooth chamfered edge reflections */
		--filter: blur(90px) saturate(160%) brightness(1.3);
		-webkit-backdrop-filter: var(--filter);
		backdrop-filter: var(--filter);
		pointer-events: none;

		-webkit-mask-image: linear-gradient(
			to bottom,
			black 0,
			black var(--offset),
			transparent var(--offset)
		);
	}
</style>
