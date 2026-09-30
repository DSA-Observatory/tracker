/// <reference path="../pb_data/types.d.ts" />

const adminRule = '(@request.auth.email = "ctw@ctwhome.com" || @request.auth.is_admin = true)';
const authenticatedRule = "@request.auth.id != ''";
const publishedReadRule = `published = true || ${adminRule}`;

function publishExistingCases(app) {
	let offset = 0;
	const batchSize = 200;

	while (true) {
		const records = app.findRecordsByFilter('cases', "id != ''", '', batchSize, offset);
		if (!records.length) break;

		for (const record of records) {
			record.set('published', true);
			app.save(record);
		}

		offset += records.length;
	}
}

migrate(
	(app) => {
		publishExistingCases(app);

		const cases = app.findCollectionByNameOrId('cases');
		cases.listRule = publishedReadRule;
		cases.viewRule = publishedReadRule;
		cases.createRule = `${adminRule} || (${authenticatedRule} && @request.body.published != true)`;
		cases.updateRule = `${adminRule} || (${authenticatedRule} && @request.body.published:changed = false)`;
		cases.deleteRule = authenticatedRule;
		const documents = cases.fields.getByName('documents');
		documents.protected = true;
		app.save(cases);

		const users = app.findCollectionByNameOrId('users');
		users.updateRule = `${adminRule} || (id = @request.auth.id && @request.body.is_admin:changed = false)`;
		app.save(users);
	},
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		cases.listRule = `published = true || ${authenticatedRule}`;
		cases.viewRule = `published = true || ${authenticatedRule}`;
		cases.createRule = authenticatedRule;
		cases.updateRule = authenticatedRule;
		cases.deleteRule = authenticatedRule;
		const documents = cases.fields.getByName('documents');
		documents.protected = false;
		app.save(cases);

		const users = app.findCollectionByNameOrId('users');
		users.updateRule = `id = @request.auth.id || @request.auth.email = "ctw@ctwhome.com" || ${adminRule}`;
		app.save(users);
	}
);
