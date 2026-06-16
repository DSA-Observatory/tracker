/// <reference path="../pb_data/types.d.ts" />

const adminEmail = 'ctw@ctwhome.com';
const adminRule = `@request.auth.email = "${adminEmail}"`;

migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  users.listRule = adminRule;
  users.viewRule = `id = @request.auth.id || ${adminRule}`;
  users.updateRule = `id = @request.auth.id || ${adminRule}`;
  users.deleteRule = `id = @request.auth.id || ${adminRule}`;

  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');

  users.listRule = 'id = @request.auth.id';
  users.viewRule = 'id = @request.auth.id';
  users.updateRule = 'id = @request.auth.id';
  users.deleteRule = 'id = @request.auth.id';

  app.save(users);
});
