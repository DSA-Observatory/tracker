<script lang="ts">
	import Login from '$lib/components/ui/Login/LoginButton.svelte';
	import Search from '$lib/components/Search.svelte';
	import { resolve } from '$app/paths';
	import { toggleMenu } from '$lib/stores/menu.store';
	import IconamoonMenuBurgerHorizontalBold from '~icons/iconamoon/menu-burger-horizontal-bold';
	import menuItems from '$lib/models/menu-itmes';

	interface Props {
		showSearch?: boolean;
	}

	let { showSearch = true }: Props = $props();
	let activeCategory = $state('');
</script>

<nav class="bien-nav mb-4 sm:mb-10">
	<div class="bien-glass"></div>
	<div class="bien-glass-edge"></div>
	<div class="relative container mx-auto py-2">
		<!--Desktop Header-->
		<header class="flex min-w-0 items-center gap-2 px-2 sm:gap-3 sm:px-0">
			<button
				class="rounded-md p-2 transition-colors duration-200 hover:bg-base-200 sm:hidden"
				onclick={toggleMenu}
				aria-label="Open menu"
			>
				<IconamoonMenuBurgerHorizontalBold class="size-6" />
			</button>
			<a
				class="no-drag mr-1 flex flex-initial shrink-0 items-center gap-2 select-none sm:mr-4 sm:gap-2.5"
				href={resolve('/')}
				aria-label="Case tracker home"
			>
				<span
					class="logo-mark grid size-9 place-items-center rounded-2xl bg-primary text-xs font-black tracking-tight text-primary-content shadow-sm ring-1 ring-black/10 sm:size-10 sm:text-sm"
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
			<div class="min-w-0 flex-1"></div>
			{#if showSearch}
				<div class="hidden max-w-2xl min-w-0 px-2 sm:block sm:px-0">
					<Search />
				</div>
			{/if}
			<!-- Desktop menu -->
			<div class="z-10 hidden w-full flex-1 justify-end space-x-4 sm:flex lg:space-x-8">
				{#each menuItems as link}
					<a
						class="menu-link"
						onclick={() => (activeCategory = link.title)}
						class:active={activeCategory === link.title}
						href={resolve(link.path)}
					>
						{link.displayTitle}
					</a>
				{/each}
			</div>

			<Login />
		</header>
	</div>
</nav>

<style>
	.menu-link {
		/* @apply hover:text-secondary font-medium transition; */
	}

	.menu-link.active {
		@apply text-[var(--color-primary)];
	}

	.logo-mark {
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.38),
			0 8px 18px rgb(0 0 0 / 0.12);
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
