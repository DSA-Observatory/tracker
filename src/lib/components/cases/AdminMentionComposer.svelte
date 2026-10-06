<script lang="ts">
	export type AdminUser = {
		id: string;
		email: string;
		name?: string;
		username?: string;
	};

	let {
		id,
		label,
		placeholder = 'Write a comment... Type @ to assign an admin.',
		content = $bindable(''),
		assigneeId = $bindable(''),
		assigneeLabel,
		users,
		disabled = false,
		minHeightClass = 'min-h-24'
	}: {
		id: string;
		label: string;
		placeholder?: string;
		content?: string;
		assigneeId?: string;
		assigneeLabel?: string;
		users: AdminUser[];
		disabled?: boolean;
		minHeightClass?: string;
	} = $props();

	let textarea = $state<HTMLTextAreaElement>();
	let composer = $state<HTMLDivElement>();
	let mentionStart = $state(-1);
	let mentionQuery = $state('');
	let activeIndex = $state(0);

	const matchingUsers = $derived(
		mentionStart < 0
			? []
			: users.filter((user) => {
				const query = mentionQuery.toLocaleLowerCase();
				return [user.name, user.username, user.email].some((value) =>
					(value ?? '').toLocaleLowerCase().includes(query)
				);
			})
	);
	const assignee = $derived(users.find((user) => user.id === assigneeId));
	const shownAssigneeLabel = $derived(
		assignee ? displayName(assignee) : assigneeLabel || displayName(assignee)
	);
	const menuOpen = $derived(!disabled && mentionStart >= 0 && matchingUsers.length > 0);
	const activeOptionId = $derived(
		menuOpen && matchingUsers[activeIndex] ? `${id}-mention-${matchingUsers[activeIndex].id}` : undefined
	);

	function displayName(user?: AdminUser) {
		return user?.name || user?.username || user?.email || 'Assigned admin';
	}

	function updateMention() {
		const caret = textarea?.selectionStart ?? content.length;
		const match = content.slice(0, caret).match(/(^|\s)@([^\s@]*)$/);
		mentionStart = match ? caret - match[2].length - 1 : -1;
		mentionQuery = match?.[2] ?? '';
		activeIndex = 0;
	}

	function closeMenu() {
		mentionStart = -1;
		mentionQuery = '';
		activeIndex = 0;
	}

	function hideWhenFocusLeaves() {
		requestAnimationFrame(() => {
			if (!composer?.contains(document.activeElement)) closeMenu();
		});
	}

	function chooseUser(user: AdminUser) {
		if (mentionStart < 0) return;
		const start = mentionStart;
		const caret = textarea?.selectionStart ?? content.length;
		const mention = `@${displayName(user)}`;
		content = `${content.slice(0, start)}${mention}${content.slice(caret)}`;
		assigneeId = user.id;
		closeMenu();
		requestAnimationFrame(() => {
			if (!textarea) return;
			const nextCaret = start + mention.length;
			textarea.focus();
			textarea.setSelectionRange(nextCaret, nextCaret);
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && mentionStart >= 0) {
			event.preventDefault();
			closeMenu();
			return;
		}
		if (!menuOpen) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % matchingUsers.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + matchingUsers.length) % matchingUsers.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			chooseUser(matchingUsers[activeIndex]);
		}
	}

	$effect(() => {
		if (!activeOptionId) return;
		requestAnimationFrame(() => {
			document.getElementById(activeOptionId)?.scrollIntoView({ block: 'nearest' });
		});
	});

	$effect(() => {
		if (disabled) closeMenu();
	});
</script>

<div class="relative" bind:this={composer}>
	<label class="sr-only" for={id}>{label}</label>
	<textarea
		bind:this={textarea}
		{id}
		class={`textarea-bordered textarea w-full ${minHeightClass}`}
		bind:value={content}
		maxlength="4000"
		{placeholder}
		{disabled}
		aria-autocomplete="list"
		aria-haspopup="listbox"
		aria-controls={menuOpen ? `${id}-mentions` : undefined}
		aria-activedescendant={activeOptionId}
		oninput={updateMention}
		onkeydown={handleKeydown}
		onclick={updateMention}
		onfocus={updateMention}
		onblur={hideWhenFocusLeaves}
	></textarea>
	{#if menuOpen}
		<div
			id={`${id}-mentions`}
			class="absolute right-0 bottom-full z-20 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-lg"
			role="listbox"
			aria-label="Assign comment to an administrator"
		>
			{#each matchingUsers as user, index (user.id)}
				<button
					id={`${id}-mention-${user.id}`}
					type="button"
					class={`block w-full rounded-md px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-base-200' : 'hover:bg-base-200'}`}
					role="option"
					aria-selected={index === activeIndex}
					onmousedown={(event) => event.preventDefault()}
					onclick={() => chooseUser(user)}
				>
					<span class="block font-medium">{displayName(user)}</span>
					{#if user.email !== displayName(user)}
						<span class="block text-xs text-base-content/65">{user.email}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
	{#if assigneeId}
		<div class="mt-2 flex flex-wrap items-start gap-2">
			<span class="min-w-0 flex-1 rounded-xl border border-base-content/30 px-3 py-1 text-xs leading-5 break-words">Assigned to {shownAssigneeLabel}</span>
			<button
				type="button"
				class="btn btn-ghost btn-xs shrink-0"
				{disabled}
				onclick={() => {
					assigneeId = '';
					closeMenu();
				}}>Clear assignment</button
			>
		</div>
	{/if}
</div>
