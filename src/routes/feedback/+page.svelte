<script lang="ts">
	import { pb } from '$lib/database';

	let message = $state('');
	let contact = $state('');
	let saving = $state(false);
	let success = $state(false);
	let error = $state('');
	let fieldErrors = $state<Record<string, string>>({});

	async function submitFeedback(form: HTMLFormElement) {
		if (saving) return;
		fieldErrors = {};
		error = '';
		success = false;

		if (!message.trim()) fieldErrors.message = 'Tell us what you would like to report or improve.';
		if (message.trim().length > 5000) fieldErrors.message = 'Keep your message under 5,000 characters.';
		const contactInput = form.elements.namedItem('contact') as HTMLInputElement;
		if (!contactInput.validity.valid) fieldErrors.contact = 'Enter a valid email address or leave this blank.';

		if (Object.keys(fieldErrors).length) {
			(form.elements.namedItem(Object.keys(fieldErrors)[0]) as HTMLElement)?.focus();
			return;
		}

		saving = true;
		try {
			await pb.collection('website_feedback').create({
				message: message.trim(),
				contact: contact.trim()
			});
			message = '';
			contact = '';
			success = true;
		} catch (err) {
			console.error('Error submitting website feedback:', err);
			error = 'Could not send your feedback. Please try again later.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Website Feedback | DSA Case Law Tracker</title>
	<meta name="description" content="Report a bug or suggest an improvement to the DSA Case Law Tracker." />
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
	<section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<p class="text-sm font-semibold tracking-[0.2em] text-primary uppercase">Contact us</p>
		<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Website feedback</h1>
		<p class="mt-4 max-w-2xl leading-7 text-slate-600">
			Report a bug or suggest an improvement to the case tracker. Your message is sent privately to the project team.
		</p>

		{#if success}
			<div role="status" class="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
				Thank you. Your feedback has been sent to the project team.
			</div>
		{/if}
		{#if error}
			<div role="alert" class="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
		{/if}

		<form class="mt-8 space-y-5" novalidate onsubmit={(event) => { event.preventDefault(); submitFeedback(event.currentTarget); }}>
			<fieldset disabled={saving} class="space-y-5">
				<label class="grid gap-2">
					<span class="font-semibold text-slate-900">Message</span>
					<textarea name="message" class="textarea min-h-40 w-full" bind:value={message} required maxlength="5000" aria-invalid={!!fieldErrors.message} aria-describedby={fieldErrors.message ? 'message-error' : undefined}></textarea>
					{#if fieldErrors.message}<span id="message-error" class="text-sm text-red-700">{fieldErrors.message}</span>{/if}
				</label>
				<label class="grid gap-2">
					<span class="font-semibold text-slate-900">Email <span class="font-normal text-slate-500">(optional)</span></span>
					<span class="text-sm text-slate-600">Add an email address if you would like us to follow up.</span>
					<input name="contact" class="input w-full" type="email" bind:value={contact} maxlength="254" autocomplete="email" aria-invalid={!!fieldErrors.contact} aria-describedby={fieldErrors.contact ? 'contact-error' : undefined} />
					{#if fieldErrors.contact}<span id="contact-error" class="text-sm text-red-700">{fieldErrors.contact}</span>{/if}
				</label>
			</fieldset>
			<button class="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send feedback'}</button>
		</form>
	</section>
</main>
