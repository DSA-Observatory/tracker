# DSA Case Law Tracker

A SvelteKit and PocketBase prototype for a public, open-access web platform tracking private enforcement cases under the EU Digital Services Act across EU Member States.

The project is being prepared for the Institute for Information Law (IViR), University of Amsterdam, and the DSA Observatory as part of the 2026 private enforcement research work.

## Project Summary

The tracker gives the research team a hands-on editorial system for entering, managing, reviewing, and publishing structured case data. The public site presents those cases in a searchable, filterable format with room for maps, timelines, data exports, and later AI/NLP analysis.

At the prototype stage, the product should behave like a curated editorial tracker rather than a large archive. The architecture should still be scalable enough to grow into a broader research platform.

See `ROADMAP.md` for current progress, production launch requirements, and a demo script for showing the engineering work behind the tracker.

## Core Audience

- DSA Observatory and IViR researchers.
- Civil society organizations and litigation actors.
- Academics and legal professionals.
- Policymakers and regulators.
- Litigation funders and journalists.
- External contributors who may submit case leads.

## Scope

- Initial scope: private enforcement cases under the EU Digital Services Act.
- Primary starting jurisdiction: Netherlands, with broader EU Member State coverage over time.
- Initial data sources: Rechtspraak.nl, CURIA, national case law databases, public court documents, expert networks, and community submissions.
- Future expansion: broader big tech litigation, including data protection, consumer protection, and competition law.

## Case Data Model

Each case entry should support the following fields.

| Field               | Purpose                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| `case_id`           | Internal unique identifier.                                                            |
| `title`             | Case title or name.                                                                    |
| `ecli`              | ECLI number or comparable identifier.                                                  |
| `filing_date`       | Date case was filed, where known.                                                      |
| `decision_date`     | Date of decision, if applicable.                                                       |
| `status`            | Pending, decided, appealed, closed, draft, review, or published depending on workflow. |
| `court`             | Court or courts involved.                                                              |
| `jurisdiction`      | Country or region.                                                                     |
| `plaintiffs`        | Plaintiff names.                                                                       |
| `defendants`        | Defendant names.                                                                       |
| `summary`           | Editorial case summary.                                                                |
| `timeline`          | Procedural timeline or key source-derived case events.                                 |
| `categories`        | High-level legal categories, such as due diligence or intermediary liability.          |
| `themes`            | More specific themes, such as dark patterns, account blocking, or data access.         |
| `primary_sources`   | Rulings, pleadings, court documents, or other primary case materials.                  |
| `secondary_sources` | Press releases, journalism, commentary, or other contextual sources.                   |
| `keywords`          | Tags, legal themes, and descriptive terms.                                             |
| `dsa_articles`      | Relevant DSA articles.                                                                 |
| `documents`         | Links or uploaded files for decisions, pleadings, press releases, or public documents. |
| `citations_to`      | Cases this decision cites.                                                             |
| `cited_by`          | Cases that cite this decision.                                                         |
| `commentary`        | Notable coverage, context, reports, or blog posts.                                     |
| `published`         | Public visibility flag.                                                                |

## MVP Features

- Discovery, UX, visual identity alignment, information architecture, and data model definition.
- PocketBase database schema, validation rules, authentication, and file storage.
- Admin workflow for creating, editing, deleting, reviewing, and publishing cases.
- Structured case entry template with DSA article references and document uploads.
- Public case list with filters by jurisdiction, status, date range, and thematic tags.
- Case detail page with structured metadata, linked court documents, summaries, and references.
- Full-text keyword search across titles, summaries, metadata, and other searchable case fields.
- Community submission questionnaire with moderation before publication.
- CI/CD and deployment pipeline.
- Documentation, admin guide, and onboarding session.

## Optional And Phase 2 Features

- Interactive EU jurisdiction map with click-through filtering by country.
- Tag system and cross-linking by DSA article, legal theme, and enforcement type.
- Bulk import from CSV, Excel, or other structured source files.
- Timeline visualization of procedural events.
- Advanced filters by party type, court level, outcome, DSA article, and keyword.
- Email notifications or newsletter for new cases and saved interests.
- Public REST API for researchers.
- CSV/JSON export of filtered results.
- Citation network and linked decision graph.

## Future AI/NLP Features

- Semantic search using vector embeddings.
- LLM-powered "talk to the cases" interface.
- Automated case summarization from court documents.
- Cross-language search across Dutch, German, French, and English sources.
- Automated DSA article and case-category tagging.
- Trend analysis across jurisdictions, defendants, enforcement areas, and outcomes.

## Data Ingestion Pipeline

The intended ingestion model is async and editorially reviewed.

1. Detect possible cases through Rechtspraak.nl RSS feeds, keyword monitoring, community submissions, and expert network tips.
2. Parse metadata such as ECLI identifiers, court, jurisdiction, date, and parties.
3. Queue candidate cases for editorial review.
4. Researchers validate the entry, add summary, tags, DSA article classification, and source links.
5. Approved cases are published to the public tracker.
6. Search indexes, maps, filters, and notifications update after publication.

Suggested keyword examples include `Digital Services Act`, `DSA`, and `Verordening digitale diensten`.

### Review-only XLSX replacement planning

For the applied replacement's editorial follow-up, publication review and recovery notes, see [Data next actions](docs/data-next-actions.md).

`scripts/plan-cases-replacement.py` reads the DSA sheet, production JSON snapshots, and a fully reviewed row-mapping CSV to produce private review artifacts. It has no network, authentication, PocketBase write, apply, or delete functionality. Use a private output directory outside the repository; the command creates `normalized-cases.json`, `migration-plan.json`, and `migration-review.csv` with directory/file modes `0700`/`0600` and refuses to overwrite existing outputs.

```sh
python3 scripts/plan-cases-replacement.py /path/to/cases.xlsx \
  --cases /private/path/production-cases.json \
  --comments /private/path/production-case_comments.json \
  --matches /private/path/workbook-reconciliation.csv \
  --comment-audit /private/path/comment-alignment.csv \
  --out-dir /private/path/prepared-plan
```

Every mapping remains an approval-required proposal; candidate matches are blocking and unresolved. Blank workbook replacement fields are explicit clearing proposals. Unmapped production records and their comments must be retained or hidden, never deleted. Before any separately implemented application step, export and compare fresh snapshot hashes, take a complete backup, and require a rollback-capable transaction. Do not use the old replacement importer for this reviewed migration: its title-derived IDs and stale-record deletion can break record identity and cascade comment history.

### Approved replacement application

`scripts/apply-cases-replacement.py` is a narrowly scoped companion for an explicitly approved plan. It is dry-run by default, accepts only verified planner artifacts and source hashes, writes its private batch/rollback artifacts outside the repository, and never writes `case_comments` or deletes records. `--apply` additionally requires an exact HTTPS target confirmation, a fresh production snapshot match, a verified server backup, and one PocketBase batch transaction; it restores the prior batch setting afterward.

```sh
python3 scripts/apply-cases-replacement.py \
  --normalized /private/path/prepared-plan/normalized-cases.json \
  --plan /private/path/prepared-plan/migration-plan.json \
  --xlsx /private/path/cases.xlsx \
  --cases /private/path/production-cases.json \
  --comments /private/path/production-case_comments.json \
  --matches /private/path/workbook-reconciliation.csv \
  --comment-audit /private/path/comment-alignment.csv \
  --out-dir /private/path/application-dry-run
```

Do not use `--apply` until a reviewer has checked the dry-run artifacts and provided the target confirmation. On an ambiguous batch error, do not retry: inspect the private receipt and reconcile the deterministic record IDs first.

## Open Product Decisions

- Should the tracker publish one entry per judicial decision, or bundle multiple decisions under one case/dispute page?
- Should the public scope be private enforcement only, or include public enforcement cases too?
- Which date fields should drive filtering and timelines: filing date, decision date, appeal date, or multiple procedural events?
- Which documents can be published or linked from public sources, and which may need to be requested from parties?
- Should interpretative analysis live inside the tracker or in separate DSA Observatory blog/report outputs?
- Should maps and timelines be native features or embedded through tools such as Datawrapper?

## Reference Platforms

- DSA Observatory: https://dsa-observatory.eu/
- Tech Justice Law Project litigation tracker: https://techjusticelaw.org/2024/02/07/big-tech-litigation-tracker/
- Climate Case Chart: https://www.climatecasechart.com/
- Columbia Global Freedom of Expression Database.
- Stanford World Intermediary Liability Map (WILMap).

## Technical Stack

- Frontend: SvelteKit 2 with Svelte 5.
- Styling: Tailwind CSS 4 and DaisyUI.
- Backend: PocketBase with SQLite, built-in admin UI, auth, REST API, and file storage.
- Search: SQLite FTS5 for MVP, with Typesense or Meilisearch as a possible later upgrade.
- Maps: Leaflet or MapLibre.
- Visualizations: Datawrapper embeds or D3.
- Ingestion: standalone TypeScript cron scripts that push reviewed candidates into PocketBase.
- Hosting: static/frontend hosting plus a small Hetzner VPS for PocketBase.
- Runtime: Bun.
- Containerization: Docker Compose.

## Development

### Case access

Published cases are public. Only accounts with `is_admin = true` can read unpublished or archived cases, or create, edit, publish and delete cases. Signing in alone does not grant editorial access. The application and PocketBase rules enforce the admin role; public registration and profile updates cannot grant it. Uploaded case files are protected by the case view rule. Admins should unpublish problematic cases rather than delete records with comment history.

### Prerequisites

- Docker and Docker Compose.
- Bun for local scripts.

### Start The Development Environment

```sh
docker compose up
```

Default services:

- PocketBase: `http://localhost:64011`
- Frontend: `http://localhost:64010`

Use `make dev-web` to run Vite locally with local PocketBase. To run the local frontend against production PocketBase instead, set `POCKETBASE_PROD_URL` to its HTTPS URL in `.env` and run:

```sh
make dev-prod
```

This does not start local PocketBase or deploy anything. **App writes affect production data.**

Account verification requires `pocketbase/pb_hooks/admin_users.pb.js` on the PocketBase server, not only the frontend. Deploy it to the server's persistent hooks volume and restart only the matching PocketBase service after checking for pending migrations. Take fresh snapshots, a full verified backup, and a copy of existing hooks first; rollback restores the previous hook and restarts that service. Deploying a hook does not authorize deploying pending schema migrations.

The verification hook was deployed on 1 October 2026 without changing records or schema. Private snapshots, the verified backup, previous hooks, and verification receipt are in `~/Library/Application Support/DSA Case Tracker/deployments/2026-10-01-admin-verification/`. An unauthenticated request returns 401; an explicit admin with invalid boolean input returns 400; valid input targeting a nonexistent account returns 404. No account was verified as part of deployment.

### Invitations and account recovery

New invitations use `pocketbase/pb_hooks/account_invitations.pb.js` and migration 18's private `account_invitations` collection. The frontend and backend changes must be deployed together, with the production backup/approval safeguards above. Adding these files locally does not install them on production.

First-time invitation links have no time expiry. They are single-use, can be revoked, and become unusable after an account password/email change. Admins can resend a pending invitation without deleting the user; resending replaces the previous link. Only token hashes are stored. Invitation secrets travel in the URL fragment, not the query string, and opening an email link does not consume it.

Existing accounts are not automatically converted to initial invitations, even if unverified. Admins can explicitly choose **Send recovery link** to issue a non-expiring, single-use, revocable recovery link while preserving the account ID and roles. Resend never revives a consumed or revoked link; a new recovery authorization requires this explicit admin action. The login form's **Forgot your password?** link uses ordinary, time-limited PocketBase resets; open the newest email promptly. Never delete/recreate an account to resend a link: this changes its ID, can affect related records, and loses its roles.

Account failures show actionable guidance plus copyable timestamp, operation, HTTP status and backend field codes/messages. These reports exclude passwords, tokens, request bodies and token-bearing URLs. An accepted mail request is not proof of inbox delivery.

The recovery hook and migration 18 were deployed on 2 October 2026, with the password page served as a real HTTP 200 entry on GitHub Pages. Production SMTP is configured in PocketBase, not environment variables, so the environment-sync SMTP hook was deliberately not installed there; the existing SMTP configuration was preserved. Fresh snapshots, verified full backup, previous backend/frontend files, configuration rollback and deployment receipts are private at `~/Library/Application Support/DSA Case Tracker/deployments/20261002t191030z-account-recovery/`. Rollback must preserve current user passwords, account IDs and editorial records; do not blindly restore the full database backup.

### Environment Variables

Copy `.env.example` if you need to override defaults.

```sh
cp .env.example .env
```

Important values:

| Variable                    | Description                | Default                  |
| --------------------------- | -------------------------- | ------------------------ |
| `POCKETBASE_PORT`           | PocketBase host port       | `64011`                  |
| `FRONTEND_PORT`             | Frontend dev server port   | `64010`                  |
| `PUBLIC_APP_URL`            | Public frontend app URL    | `http://localhost:64010` |
| `PUBLIC_POCKETBASE_URL`     | Browser PocketBase URL     | `http://localhost:64011` |
| `POCKETBASE_URL`            | Server-side PocketBase URL | `http://pocketbase:8090` |
| `POCKETBASE_ADMIN_EMAIL`    | First-run admin email      | `admin@admin.local`      |
| `POCKETBASE_ADMIN_PASSWORD` | First-run admin password   | `1234567890`             |
| `SMTP_ENABLED`              | Enable PocketBase email    | `false`                  |
| `SMTP_HOST`                 | SMTP server host           | `smtp.resend.com`        |
| `SMTP_PORT`                 | SMTP server port           | `587`                    |
| `SMTP_USER`                 | SMTP username              | `resend`                 |
| `SMTP_PASS`                 | Resend SMTP/API password   |                          |
| `SMTP_FROM`                 | Verified sender address    |                          |

Change default credentials immediately after first login.

For Resend, set `SMTP_ENABLED=true`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_USER=resend`, `SMTP_PASS` to your Resend API key, `SMTP_FROM` to an address on a verified Resend domain, and `PUBLIC_APP_URL` to the deployed frontend URL (not the PocketBase API URL). Restart PocketBase after changing these values so the SMTP bootstrap hook can synchronize them into the PocketBase database.

## GitHub Pages Deployment

The frontend can be deployed as a static site to GitHub Pages even when the repository stays private. The workflow in `.github/workflows/deploy-pages.yml` builds the SvelteKit static output and publishes the `build/` directory.

Private repositories require a GitHub plan that supports Pages from private repos. The published Pages site is public unless your organization has GitHub Enterprise features for private Pages access control.

In GitHub, enable Pages for this repository:

1. Open `Settings` -> `Pages`.
2. Set `Source` to `GitHub Actions`.
3. Push to `main` or run `Deploy GitHub Pages` manually from the `Actions` tab.

For a normal project page, the workflow defaults `BASE_PATH` to `/<repository-name>`. For this repository, that means `/tracker`.

Set these repository variables in GitHub if needed:

| Variable                | Purpose                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `BASE_PATH`             | Override the GitHub Pages base path. Use an empty/custom-domain setup only if the site is served from the domain root. |
| `PUBLIC_APP_URL`        | Public URL of the deployed frontend. PocketBase password setup emails link to `{PUBLIC_APP_URL}/password`.             |
| `PUBLIC_POCKETBASE_URL` | Public URL of the deployed PocketBase backend. GitHub Pages only hosts the frontend.                                   |

The current public landing pages can deploy without a live PocketBase backend, but auth, admin-backed case data, submissions, and future tracker data need PocketBase hosted separately.

## Extracted Source Material

This README consolidates information from the project notes and supporting documents in:

`/Users/ctw/Second Brain/Projects/CTW Consulting/2026 - Case Law Tracker`

Source material included markdown project notes, meeting notes, development plan, offer document, memo, proposal PDF, and kickoff/presentation slides.
