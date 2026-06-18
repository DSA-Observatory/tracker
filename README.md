# DSA Case Law Tracker

A SvelteKit and PocketBase prototype for a public, open-access web platform tracking private enforcement cases under the EU Digital Services Act across EU Member States.

The project is being prepared for the Institute for Information Law (IViR), University of Amsterdam, and the DSA Observatory as part of the 2026 private enforcement research work.

## Project Summary

The tracker gives the research team a hands-on editorial system for entering, managing, reviewing, and publishing structured case data. The public site presents those cases in a searchable, filterable format with room for maps, timelines, data exports, and later AI/NLP analysis.

At the prototype stage, the product should behave like a curated editorial tracker rather than a large archive. The architecture should still be scalable enough to grow into a broader research platform.

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

### Prerequisites

- Docker and Docker Compose.
- Bun for local scripts.

### Start The Development Environment

```sh
docker compose up
```

Default services:

- PocketBase: `http://localhost:8095`
- Frontend: `http://localhost:8085`

### Environment Variables

Copy `.env.example` if you need to override defaults.

```sh
cp .env.example .env
```

Important values:

| Variable                    | Description                | Default                  |
| --------------------------- | -------------------------- | ------------------------ |
| `POCKETBASE_PORT`           | PocketBase host port       | `8095`                   |
| `FRONTEND_PORT`             | Frontend dev server port   | `8085`                   |
| `PUBLIC_POCKETBASE_URL`     | Browser PocketBase URL     | `http://localhost:8095`  |
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

For Resend, set `SMTP_ENABLED=true`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_USER=resend`, `SMTP_PASS` to your Resend API key, and `SMTP_FROM` to an address on a verified Resend domain. Restart PocketBase after changing these values so the SMTP settings migration can save them into the PocketBase database.

## GitHub Pages Deployment

The frontend can be deployed as a static site to GitHub Pages. The workflow in `.github/workflows/deploy-pages.yml` builds the SvelteKit static output and publishes the `build/` directory.

For a normal project page, the workflow defaults `BASE_PATH` to `/<repository-name>`. For this repository, that means `/tracker`.

Set these repository variables in GitHub if needed:

| Variable                | Purpose                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `BASE_PATH`             | Override the GitHub Pages base path. Use an empty/custom-domain setup only if the site is served from the domain root. |
| `PUBLIC_POCKETBASE_URL` | Public URL of the deployed PocketBase backend. GitHub Pages only hosts the frontend.                                   |

The current public landing pages can deploy without a live PocketBase backend, but auth, admin-backed case data, submissions, and future tracker data need PocketBase hosted separately.

## Extracted Source Material

This README consolidates information from the project notes and supporting documents in:

`/Users/ctw/Second Brain/Projects/CTW Consulting/2026 - Case Law Tracker`

Source material included markdown project notes, meeting notes, development plan, offer document, memo, proposal PDF, and kickoff/presentation slides.
