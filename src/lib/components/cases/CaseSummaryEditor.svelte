<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import Link from '@tiptap/extension-link';
	import Underline from '@tiptap/extension-underline';
	import StarterKit from '@tiptap/starter-kit';
	import IconBold from '~icons/lucide/bold';
	import IconHeading2 from '~icons/lucide/heading-2';
	import IconItalic from '~icons/lucide/italic';
	import IconLink from '~icons/lucide/link';
	import IconList from '~icons/lucide/list';
	import IconListOrdered from '~icons/lucide/list-ordered';
	import IconPilcrow from '~icons/lucide/pilcrow';
	import IconQuote from '~icons/lucide/quote';
	import IconRedo from '~icons/lucide/redo-2';
	import IconUnderline from '~icons/lucide/underline';
	import IconUndo from '~icons/lucide/undo-2';

	let { value = $bindable('') }: { value: string } = $props();

	let editorElement: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	let lastHtml = '';
	let active = $state({
		bold: false,
		italic: false,
		underline: false,
		heading2: false,
		paragraph: false,
		bulletList: false,
		orderedList: false,
		blockquote: false,
		link: false
	});

	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit,
				Underline,
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						rel: 'noreferrer',
						target: '_blank'
					}
				})
			],
			content: value,
			onCreate: ({ editor }) => syncActiveState(editor),
			onFocus: ({ editor }) => {
				if (editor.isEmpty) clearStoredMarks(editor);
				syncActiveState(editor);
			},
			onSelectionUpdate: ({ editor }) => syncActiveState(editor),
			onTransaction: ({ editor }) => syncActiveState(editor),
			onUpdate: ({ editor }) => {
				const html = editor.getHTML();
				lastHtml = html;
				value = html;
				syncActiveState(editor);
			}
		});

		lastHtml = value;
	});

	onDestroy(() => {
		editor?.destroy();
	});

	$effect(() => {
		if (!editor || value === lastHtml) return;
		editor.commands.setContent(value, { emitUpdate: false });
		lastHtml = value;
	});

	function toggleLink() {
		if (!editor) return;
		const current = editor.getAttributes('link').href as string | undefined;
		const href = prompt('Link URL', current ?? '');

		if (href === null) return;
		if (!href.trim()) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
	}

	function syncActiveState(editor: Editor) {
		const hasContent = !editor.isEmpty;

		active = {
			bold: hasContent && editor.isActive('bold'),
			italic: hasContent && editor.isActive('italic'),
			underline: hasContent && editor.isActive('underline'),
			heading2: editor.isActive('heading', { level: 2 }),
			paragraph: editor.isActive('paragraph'),
			bulletList: editor.isActive('bulletList'),
			orderedList: editor.isActive('orderedList'),
			blockquote: editor.isActive('blockquote'),
			link: hasContent && editor.isActive('link')
		};
	}

	function clearStoredMarks(editor: Editor) {
		editor.chain().unsetBold().unsetItalic().unsetUnderline().unsetLink().run();
	}

	function runToolbarCommand(event: PointerEvent, command: () => void) {
		event.preventDefault();
		event.stopPropagation();
		command();
	}
</script>

<div class="case-summary-editor border border-base-300 bg-base-100">
	<div class="toolbar flex flex-wrap gap-1 border-b border-base-300 bg-base-200/60 p-1">
		<button
			class:active={active.bold}
			type="button"
			title="Bold"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleBold().run())}
			><IconBold /></button
		>
		<button
			class:active={active.italic}
			type="button"
			title="Italic"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleItalic().run())}
			><IconItalic /></button
		>
		<button
			class:active={active.underline}
			type="button"
			title="Underline"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleUnderline().run())}
			><IconUnderline /></button
		>
		<button
			class:active={active.heading2}
			type="button"
			title="Heading"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
			><IconHeading2 /></button
		>
		<button
			class:active={active.paragraph}
			type="button"
			title="Paragraph"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().setParagraph().run())}
			><IconPilcrow /></button
		>
		<button
			class:active={active.bulletList}
			type="button"
			title="Bullet list"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleBulletList().run())}
			><IconList /></button
		>
		<button
			class:active={active.orderedList}
			type="button"
			title="Ordered list"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleOrderedList().run())}
			><IconListOrdered /></button
		>
		<button
			class:active={active.blockquote}
			type="button"
			title="Quote"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().toggleBlockquote().run())}
			><IconQuote /></button
		>
		<button
			class:active={active.link}
			type="button"
			title="Link"
			onpointerdown={(event) => runToolbarCommand(event, toggleLink)}><IconLink /></button
		>
		<button
			type="button"
			title="Undo"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().undo().run())}><IconUndo /></button
		>
		<button
			type="button"
			title="Redo"
			onpointerdown={(event) =>
				runToolbarCommand(event, () => editor?.chain().focus().redo().run())}><IconRedo /></button
		>
	</div>
	<div class="editor-content" bind:this={editorElement}></div>
</div>

<style>
	.toolbar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 1.8rem;
		min-width: 1.8rem;
		padding: 0 0.55rem;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.toolbar button :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.toolbar button:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.toolbar button.active {
		background: #f9c400;
		border-color: #111827;
		box-shadow: inset 0 0 0 1px #111827;
		color: #111827;
	}

	.editor-content :global(.ProseMirror) {
		min-height: 12rem;
		padding: 0.75rem;
		outline: none;
	}

	.editor-content :global(.ProseMirror > * + *) {
		margin-top: 0.5rem;
	}

	.editor-content :global(h2) {
		font-size: 1.15rem;
		font-weight: 700;
	}

	.editor-content :global(ul),
	.editor-content :global(ol) {
		padding-left: 1.25rem;
	}

	.editor-content :global(blockquote) {
		border-left: 3px solid var(--fallback-bc, oklch(var(--bc) / 0.25));
		padding-left: 0.75rem;
		color: var(--fallback-bc, oklch(var(--bc) / 0.7));
	}
</style>
