/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('account_invitations');
			return;
		} catch {
			// Create the private collection below.
		}

		const users = app.findCollectionByNameOrId('users');
		const invitations = new Collection({
			name: 'account_invitations',
			type: 'base',
			system: false,
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					name: 'user',
					type: 'relation',
					required: true,
					collectionId: users.id,
					cascadeDelete: true,
					maxSelect: 1,
					hidden: false,
					presentable: false
				},
				{
					name: 'email',
					type: 'email',
					required: true,
					hidden: true,
					presentable: false
				},
				{
					name: 'token_hash',
					type: 'text',
					required: true,
					min: 64,
					max: 64,
					pattern: '^[a-f0-9]{64}$',
					hidden: true,
					presentable: false
				},
				{
					name: 'token_key_hash',
					type: 'text',
					required: true,
					min: 64,
					max: 64,
					pattern: '^[a-f0-9]{64}$',
					hidden: true,
					presentable: false
				},
				{
					name: 'state',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['pending', 'used', 'revoked'],
					hidden: false,
					presentable: false
				},
				{
					name: 'purpose',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['setup', 'recovery'],
					hidden: false,
					presentable: false
				},
				{
					name: 'created',
					type: 'autodate',
					onCreate: true,
					onUpdate: false,
					hidden: false,
					presentable: false
				},
				{
					name: 'updated',
					type: 'autodate',
					onCreate: true,
					onUpdate: true,
					hidden: false,
					presentable: false
				}
			],
			indexes: ['CREATE UNIQUE INDEX idx_account_invitations_user ON account_invitations (user)']
		});

		app.save(invitations);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('account_invitations'));
		} catch {
			// The collection was already removed.
		}
	}
);
