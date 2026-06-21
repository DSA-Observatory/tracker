# Roadmap

This roadmap tracks what is already working, what still needs to be finished before a production launch, and how to demonstrate the engineering work behind the tracker.

## Current Status

The project is now a Phase 2 research-grade prototype for a DSA private enforcement case law tracker. It has a documented product direction, a local PocketBase setup, imported case data, public search/filtering, public case detail pages, editorial case management, community submissions, exports, and deployment workflow files.

## Delivery Phases

These phases separate what was delivered at each handoff so the project history is clear for presentations, invoices, and stakeholder updates.

### Phase 0: Project Setup And Direction

- [x] Project direction documented for the DSA Case Law Tracker.
- [x] Core audience, scope, MVP features, data model, and future AI/NLP ideas captured in `README.md`.
- [x] SvelteKit 2 / Svelte 5 frontend scaffolded.
- [x] Tailwind CSS 4 and DaisyUI styling setup in the app.
- [x] PocketBase selected and included as the backend/database choice.
- [x] Docker Compose local development setup for frontend and PocketBase.
- [x] Environment variable template added in `.env.example`.
- [x] GitHub Pages and release workflow files added.

### Phase 1: MVP Tracker Foundation

- [x] PocketBase migrations added for initial setup, cases collection, admin user management, promoted case metadata, and SMTP settings.
- [x] Case import and schema utility scripts added under `scripts/`.
- [x] Normalized case data exists in `data/normalized-cases.json`.
- [x] Public case database route exists at `/cases`.
- [x] Case create and edit routes exist at `/cases/new` and `/cases/[id]/edit`.
- [x] Search and filtering feature documentation exists in `FEATURES.md`.
- [x] Case search supports global text search, scoped search, filters, result counts, chips, country display, and multiple result display modes.
- [x] Cases mobile layout keeps filters in a modal sheet, preserves room for case results, and has working mobile topbar/menu navigation.
- [x] Basic admin user management page exists at `/admin`.
- [x] Login, registration, logout, and profile UI components exist.
- [x] SMTP configuration hook/migration exists for transactional email setup.

### Phase 2: Research-Grade Public Tracker

- [x] Phase 2 case schema fields added for outcome, courts, legal areas, legal basis, case scope, procedural events, source limitations, editorial notes, and submitter attribution.
- [x] Explicit editorial workflow statuses support draft, review, published, appealed, closed, and archived cases.
- [x] Public canonical case detail route exists at `/cases/[id]` with metadata, timeline, sources, commentary, and related cases.
- [x] Case cards and table rows link to canonical public case records.
- [x] Filtered case results can be exported as CSV or JSON.
- [x] Community case lead submissions exist at `/submit`.
- [x] Authenticated submission moderation queue exists at `/admin/submissions`.
- [x] Jurisdiction browsing view exists at `/map` with click-through to filtered case results.
- [x] Navigation includes Cases, Map, Suggest a Case, and About.
- [x] `ROADMAP.md` updated to track phases and remaining launch work.

### Phase 2 Verification Notes

- [x] `npm run build` passes after Phase 2 changes.
- [ ] `npm run check` is still blocked by pre-existing unrelated project issues in demo/paraglide, optional UI dependencies, and older demo components.

## Needed Before Production

- [ ] Decide final public domain.
- [ ] Configure DNS for the frontend domain.
- [ ] Configure DNS/subdomain for Database, for example `api.example.org`.
- [ ] Finalize GitHub Pages as the production frontend host.
- [ ] Choose production hosting for Database, likely a small VPS such as Hetzner.
- [ ] Provision the production Database server.
- [ ] Set up HTTPS/TLS for both frontend and Database.
- [ ] Replace all default/local environment values with production secrets.
- [ ] Change first-run Database admin credentials immediately after setup.
- [ ] Configure a verified email sending domain.
- [ ] Enable production SMTP through Resend or another provider.
- [ ] Test invite, password reset, and login emails in production.
- [ ] Apply Database migrations to the production database.
- [ ] Import or seed the initial production case dataset.
- [ ] Define a database backup schedule.
- [ ] Test database restore from backup before launch.
- [ ] Decide whether production case data should be edited only through the custom app, Database admin, or both.
- [ ] Confirm Database collection rules for public reads, authenticated editing, admin-only user management, and unpublished draft protection.
- [x] Add an explicit editorial workflow for draft, review, published, appealed, closed, and archived statuses.
- [ ] Confirm which document files can be uploaded, linked, or publicly shown.
- [ ] Add clear privacy/copyright guidance for case documents and contributor submissions.
- [x] Add a public case detail page if not already implemented as a stable route.
- [x] Add community submission flow and moderation queue.
- [ ] Add production analytics if required.
- [ ] Add error monitoring/logging for frontend and Database.
- [ ] Run final accessibility, mobile, and browser checks.
- [ ] Re-test the cases filters, menu, and topbar on real mobile viewports before launch.
- [ ] Run `npm run check`, `npm run lint`, and `npm run build` before launch.
- [ ] Create short admin documentation for adding, editing, reviewing, and publishing cases.
- [ ] Prepare a handover/demo session for IViR/DSA Observatory users.

## Nice-To-Have Next

- [x] Public CSV/JSON export for filtered case results.
- [x] Jurisdiction visualization with click-through filtering.
- [ ] Interactive EU jurisdiction map with geographic shapes and tooltips.
- [ ] Timeline visualization for case events.
- [ ] Advanced filters for party type, court level, outcome, DSA article, and keyword.
- [ ] Bulk import UI for CSV/Excel updates.
- [ ] Public REST API for researchers.
- [ ] Citation graph or linked decision network.
- [ ] Newsletter or notification workflow for new cases.
- [ ] Semantic search and AI-assisted case exploration after the editorial database is stable.

## Launch Checklist

- [ ] Domain selected.
- [ ] Frontend production URL live.
- [ ] Database production URL live.
- [ ] HTTPS confirmed.
- [ ] Production environment variables configured.
- [ ] Production admin credentials secured.
- [ ] SMTP verified and tested.
- [ ] Production database migrated.
- [ ] Initial cases imported.
- [ ] Backups configured and restore-tested.
- [ ] Public pages checked on desktop and mobile.
- [ ] Admin/editing workflow tested by at least one real user.
- [ ] Final build and checks passing.
- [ ] Admin guide delivered.
