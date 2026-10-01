<script lang="ts">
	import { parseSources, type SourceEntry } from '$lib/case-sources';

	let { sources = [], emptyLabel = 'None recorded' }: { sources?: string[]; emptyLabel?: string } =
		$props();

	const entries = $derived(parseSources(sources));

	type TextPart = { text: string; href?: string };

	function safeHref(value: string) {
		try {
			const url = new URL(value);
			if (
				(url.protocol === 'http:' || url.protocol === 'https:') &&
				!url.username &&
				!url.password
			) {
				return value;
			}
		} catch {
			// Render malformed and unsafe values as plain text.
		}
		return undefined;
	}

	function trimLinkPunctuation(value: string) {
		let link = value.replace(/[.,;:!?]+$/, '');
		while (link.endsWith(')') && link.split(')').length - 1 > link.split('(').length - 1) {
			link = link.slice(0, -1);
		}
		return link;
	}

	function legacyParts(value: string): TextPart[] {
		const parts: TextPart[] = [];
		let cursor = 0;

		for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
			const index = match.index ?? 0;
			if (index > cursor) parts.push({ text: value.slice(cursor, index) });

			const link = trimLinkPunctuation(match[0]);
			const href = safeHref(link);
			parts.push(href ? { text: link, href } : { text: link });
			cursor = index + link.length;
		}

		if (cursor < value.length) parts.push({ text: value.slice(cursor) });
		return parts;
	}

	function displayText(entry: SourceEntry) {
		return entry.title.trim() || entry.url;
	}
</script>

<!-- Source URLs are validated external HTTP(S) links, not application routes. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<ul class="min-w-0 space-y-2 text-sm [overflow-wrap:anywhere] text-slate-600">
	{#each entries as entry, index (`${entry.original?.raw ?? entry.url}-${index}`)}
		<li class="[overflow-wrap:anywhere] whitespace-pre-line">
			{#if !entry.original?.legacy && safeHref(entry.url)}
				<a
					class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
					href={safeHref(entry.url)}
					target="_blank"
					rel="noopener noreferrer"
				>
					{displayText(entry)}
				</a>
			{:else}
				{#each legacyParts(entry.original?.raw ?? entry.title) as part, partIndex (`${part.text}-${partIndex}`)}
					{#if part.href}
						<a
							class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
							href={part.href}
							target="_blank"
							rel="noopener noreferrer"
						>
							{part.text}
						</a>
					{:else}
						{part.text}
					{/if}
				{/each}
			{/if}
		</li>
	{/each}
	{#if !entries.length}<li>{emptyLabel}</li>{/if}
</ul>
