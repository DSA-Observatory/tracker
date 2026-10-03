<script lang="ts">
	import type { AuthFailure } from '$lib/auth-errors';

	let { failure }: { failure: AuthFailure } = $props();
	let copyMessage = $state('');
	$effect(() => {
		if (failure.report) copyMessage = '';
	});

	async function copyDetails() {
		try {
			await navigator.clipboard.writeText(failure.report);
			copyMessage = 'Copied. You can paste these details into your message to an administrator.';
		} catch {
			copyMessage = 'Copy is unavailable. Select and copy the details below instead.';
		}
	}
</script>

<div class="rounded-2xl border border-error/25 bg-error/10 p-4 text-sm" role="alert">
	<p class="font-medium text-base-content">{failure.message}</p>
	<details class="mt-3">
		<summary class="cursor-pointer font-semibold">Details to send to an administrator</summary>
		<pre class="mt-3 break-all whitespace-pre-wrap select-text">{failure.report}</pre>
	</details>
	<button class="btn mt-3 btn-outline btn-sm" type="button" onclick={copyDetails}>
		Copy error details
	</button>
	{#if copyMessage}
		<p class="mt-2 text-xs" role="status">{copyMessage}</p>
	{/if}
</div>
