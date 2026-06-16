<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let query = $state('');

	function submitSearch() {
		const value = query.trim();
		if (!value) return;

		goto(`${base}/cases?q=${encodeURIComponent(value)}`);
	}
</script>

<form
	class="relative"
	onsubmit={(event) => {
		event.preventDefault();
		submitSearch();
	}}
>
	<label class="input-bordered input flex items-center gap-2 opacity-80">
		<svg class="h-5 w-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<input
			type="search"
			placeholder="Search cases"
			class="grow"
			aria-label="Search cases"
			bind:value={query}
		/>
		<button class="badge hidden badge-primary sm:inline-flex" type="submit">Go</button>
	</label>
</form>
