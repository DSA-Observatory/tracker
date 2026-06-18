import { pb } from '../client';
import { browser } from '$app/environment';
import { isAdminUser } from '$lib/admin';

interface User {
	id: string;
	email: string;
	username?: string;
	is_admin?: boolean;
	verified: boolean;
	created: string;
	updated: string;
}

class AuthStore {
	user = $state<User | null>(null);
	isAuthenticated = $derived(!!this.user);
	isAdmin = $derived(isAdminUser(this.user));

	constructor() {
		if (browser) {
			this.user = pb.authStore.model as unknown as User | null;

			pb.authStore.onChange(() => {
				this.user = pb.authStore.model as unknown as User | null;
			});
		}
	}

	async login(email: string, password: string) {
		const authData = await pb.collection('users').authWithPassword(email, password);
		this.user = authData.record as unknown as User;
		return authData;
	}

	async register(email: string, password: string, passwordConfirm: string) {
		const data = {
			email,
			password,
			passwordConfirm,
			emailVisibility: true
		};
		const record = await pb.collection('users').create(data);
		// Auto-login after registration
		await this.login(email, password);
		return record;
	}

	logout() {
		pb.authStore.clear();
		this.user = null;
	}
}

export const authStore = new AuthStore();
