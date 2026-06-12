# About The DSA Case Law Tracker

The DSA Case Law Tracker is a public, open-access web platform for tracking private enforcement cases under the EU Digital Services Act across EU Member States.

It is being prepared for the Institute for Information Law (IViR), University of Amsterdam, and the DSA Observatory as part of the 2026 private enforcement research project.

## Why It Exists

Public DSA enforcement resources exist, but private enforcement developments are harder to monitor. The tracker is intended to level the information field for civil society, researchers, policymakers, litigation funders, legal professionals, and other public-interest actors.

The pilot starts with DSA-related litigation and is designed so it can later expand into broader big tech litigation, including data protection, consumer protection, and competition law.

## What The Prototype Should Support

- Editable case management for researchers through PocketBase.
- Structured case templates with dates, parties, courts, ECLI identifiers, DSA articles, summaries, keywords, documents, citations, and commentary.
- Public case browsing with search and filters.
- Case detail pages that combine metadata, editorial context, linked documents, and related references.
- Community submissions with editorial review before publication.
- Geographic and timeline visualizations as the case volume grows.

## Research Context

The tracker sits alongside case studies, expert calls, reports, and a DSA Observatory blog symposium. The product should keep case tracking distinct from broader legal analysis, while making it easy to link cases to reports, commentary, and external coverage.

## Open Product Questions

- Should multiple decisions from one dispute be bundled under one case page or published as separate entries?
- Should the public scope be strictly private enforcement, or should public enforcement cases be included too?
- Which date model best serves researchers: filing date, decision date, appeal date, or multiple procedural dates?
- Which court documents can be linked, uploaded, or requested from parties and counsel?
- Should maps and timelines be built into the site or embedded through tools such as Datawrapper?

## Technical Direction

The recommended stack is SvelteKit, Tailwind CSS, PocketBase, SQLite full-text search, PocketBase file storage, and a standalone TypeScript ingestion script for Rechtspraak.nl RSS monitoring. Later phases may add MapLibre or Leaflet maps, D3 or Datawrapper visualizations, a public API, CSV/JSON export, semantic search, and LLM-powered case Q&A.
