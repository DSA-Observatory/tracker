<script lang="ts">
	import Austria from '~icons/flagpack/at';
	import Belgium from '~icons/flagpack/be';
	import Bulgaria from '~icons/flagpack/bg';
	import Croatia from '~icons/flagpack/hr';
	import Cyprus from '~icons/flagpack/cy';
	import Czechia from '~icons/flagpack/cz';
	import Denmark from '~icons/flagpack/dk';
	import Estonia from '~icons/flagpack/ee';
	import Finland from '~icons/flagpack/fi';
	import France from '~icons/flagpack/fr';
	import Germany from '~icons/flagpack/de';
	import Greece from '~icons/flagpack/gr';
	import Hungary from '~icons/flagpack/hu';
	import Ireland from '~icons/flagpack/ie';
	import Italy from '~icons/flagpack/it';
	import Latvia from '~icons/flagpack/lv';
	import Lithuania from '~icons/flagpack/lt';
	import Luxembourg from '~icons/flagpack/lu';
	import Malta from '~icons/flagpack/mt';
	import Netherlands from '~icons/flagpack/nl';
	import Poland from '~icons/flagpack/pl';
	import Portugal from '~icons/flagpack/pt';
	import Romania from '~icons/flagpack/ro';
	import Slovakia from '~icons/flagpack/sk';
	import Slovenia from '~icons/flagpack/si';
	import Spain from '~icons/flagpack/es';
	import Sweden from '~icons/flagpack/se';

	const countryFlags = {
		Austria,
		Belgium,
		Bulgaria,
		Croatia,
		Cyprus,
		Czechia,
		'Czech Republic': Czechia,
		Denmark,
		Estonia,
		Finland,
		FR: France,
		France,
		Germany,
		Greece,
		Hungary,
		Ireland,
		Italy,
		Latvia,
		Lithuania,
		Luxembourg,
		Malta,
		Netherlands,
		Poland,
		Portugal,
		Romania,
		Slovakia,
		Slovenia,
		Spain,
		Sweden
	};

	let { country }: { country: string } = $props();
	const Flag = $derived(countryFlags[country as keyof typeof countryFlags]);
</script>

{#if Flag}
	<span class="inline-flex h-3 w-4 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-slate-300/70" aria-hidden="true">
		<Flag class="h-full w-full" />
	</span>
{/if}
