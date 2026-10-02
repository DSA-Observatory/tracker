<script lang="ts">
	let { children } = $props();
</script>

<main class="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
	<div class="prose prose-lg max-w-none">
		{@render children?.()}
	</div>
</main>
