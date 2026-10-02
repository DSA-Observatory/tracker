# Repository contract

- SvelteKit 2 / Svelte 5 frontend in `src/`; PocketBase schema and hooks in `pocketbase/`; ingestion tools in `scripts/`.
- Use Bun for JavaScript commands. Follow existing components and keep changes small; do not add dependencies without need.
- Development: `make dev` starts Docker services; `make dev-web` starts local PocketBase and Vite. `make dev-prod` starts only Vite against the HTTPS `POCKETBASE_PROD_URL` from `.env`; app writes affect production data. Default ports: frontend 64010, PocketBase 64011.
- Live iteration: defer routine tests, lint, typechecks and builds until finalization. A narrow preview or data-loss check is allowed.
- Finalization commands: `bun test`, `bun run check`, `bun run lint`, `bun run build`. For focused tests, pass the affected test path to `bun test`.
- Replacement-tool verification: `python3 -m unittest tests/test_cases_replacement.py -v`. The application tool is dry-run by default and requires an explicit confirmed HTTPS target for production writes. See `docs/data-next-actions.md` for the applied dataset's follow-up and private recovery location.
- UI acceptance when relevant: desktop 1440×900, tablet 768×1024, mobile 390×844; inspect affected routes, keyboard access, overflow and console errors. Use an isolated headless browser, never a personal authenticated session without consent.
- `scripts/plan-cases-replacement.py` creates private review artifacts only. Its normalized JSON is not a database payload. See README for usage.
- The older XLSX importer assumes a different workbook layout. Its `--replace-managed` path deletes records and can cascade-delete editorial comments; do not use it for replacement without an approved safe migration.
- Treat `.env`, production snapshots, editorial comments and workbook contact sheets as private. Keep generated reconciliation artifacts outside Git; preserve record IDs, comment associations and publication state.
- Production mutations require explicit approval, fresh snapshots, a full backup and a rollback-capable application strategy. Preparing a plan is not permission to apply it.
- Case access requires an explicit `is_admin` role, not merely a login or matching email. Migration 16 restricts case APIs and prevents self-promotion; schema migrations must never automatically publish existing records.
- First-time invitations and explicitly admin-issued recovery links use the private `account_invitations` collection and `account_invitations.pb.js` hook, not password-reset tokens. They have no time expiry, but are single-use and revocable; resend rotates the link without recreating the user. Do not infer initial-setup eligibility from `verified` or adopt existing accounts automatically; recovering an existing account requires the explicit admin recovery action. Self-service password resets remain separate and expiring.
- Account errors must expose safe field messages/codes and copyable support details, never passwords, invitation/reset tokens, request bodies or token-bearing URLs.
- Do not commit, push, merge, deploy, publish or release unless requested. Commit authority does not imply push or deployment authority. No `make release` or `make release-dry-run` exists yet.
