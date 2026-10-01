# Data review after the DSA replacement

Last updated: 1 October 2026. The cleaned data is in production, 21 additional entries have been published, and case management is restricted to admins. Entries without identified blockers should be public; admins can unpublish them if a problem is found. This follow-up list is not permission to rerun the migration or publish entries with unresolved blockers.

## What was applied

| Result                                                       | Count |
| ------------------------------------------------------------ | ----: |
| Workbook entries in the active dataset                       |    79 |
| Confirmed records updated with their existing IDs            |    44 |
| New or provisional records initially imported as drafts      |    35 |
| Historical records retained privately with status `archived` |    18 |
| Active records currently published                           |    63 |
| Active records currently unpublished                         |    16 |
| Partner comments preserved without changes                   |    20 |

The 35 entries initially imported as drafts comprise 28 separate/new decisions and seven entries whose proposed match to an old record is uncertain. On 1 October, 21 separate/new entries without identified blockers were published. Seven uncertain matches, seven other imported entries with specific blockers, and the two previously unpublished cases (TikTok and Prof. R. v YouTube) remain unpublished. No records or comments were deleted. No comments were automatically resolved. Confirmed records retained their existing summaries, timelines, dates, uploaded files and publication state.

## Who maintains the cases

Only accounts with `is_admin = true` can change cases, publish/unpublish them, see unpublished or archived records, or manage the comment queue. Ordinary signed-in users have the same case visibility as public visitors. An email address alone does not grant admin access, and users cannot promote themselves.

No individual reviewer has been assigned by this migration. The project lead should nominate one or more existing admins to maintain the list. Research partners can supply corrections and check the legal material; an admin must apply the edits and publication decisions.

Admin maintenance uses the application:

- Open `/cases`, find a case and select **Edit**; save with **Update case**.
- Choose **Published** or **Draft** in the case editor, then save, to publish or unpublish it. Setting a case to Draft hides it without deleting its history.
- Use **Create case** to add an entry and `/admin/comments` to review outstanding comments.
- Do not delete a case to hide a problem: deletion can also remove its attached comments.

The database restrictions are already live. The matching frontend/security changes are committed locally but still need an authorised push/deployment; this document update does not perform either. After deployment, confirm that ordinary users no longer see case-management controls.

## Gabi's requested website changes

Implemented locally, awaiting final checks and deployment:

- Removed themes from case tags, filters, the editor and related-case matching. Historical theme data is retained; missing themes no longer require research or block publication. Categories and DSA article classification remain.
- Added separate Title and URL inputs for primary and secondary sources, with add/remove controls and HTTP(S) URL validation. Case detail pages display clickable source titles (or the URL when no title is supplied). Existing source text and links are preserved when unchanged; legacy text-only sources remain visible rather than acquiring invented links.
- Clarified the existing separate date field as **Judgment/decision date** in the editor and case details. Missing dates still need verification against the source.

No production data was changed by these UI edits. Missing source evidence, uncertain identities, stale summaries and publication blockers below still require research/admin review. Different court-instance decisions remain separate records.

## 1. Resolve the seven uncertain identities

Owner: research partner for identity checks; nominated admin for record changes. These new entries are drafts; their possible predecessors are archived with their original content and comments intact.

| Workbook row | Draft                                   | Draft record ID   | Evidence needed                                                                                                          |
| ------------ | --------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 13           | Danny Mekić v Twitter                   | `014e06ebfa250bb` | Confirm that the old unnumbered entry refers to ECLI:NL:RBAMS:2024:3980.                                                 |
| 20           | Stichting Offlimits v X.AI / X          | `a62d6feaac009fb` | Establish whether the earlier writ entry and the new ruling should be one record or separate procedural decisions.       |
| 21           | SOMI v Twitter — Netherlands            | `ce12ff2ebd12b31` | Confirm identity from the 15 August 2024 writ. Do not confuse it with the omitted German SOMI case.                      |
| 22           | SOMI v Meta — Denmark                   | `dc66368717ad400` | Obtain a court, case number and filing reference; the press release alone does not establish the old record's identity.  |
| 27           | Brzoska and Mensah v Meta — appeal      | `a8578766736139f` | Confirm that the old appeal entry is the 27 March 2026 decision; keep it distinct from the 2024 first-instance decision. |
| 85           | Ter Hell / TER Chemicals v Your Hosting | `b8fc49f9a650e32` | Match the old unsourced entry to ECLI:NL:RBDHA:2026:1039.                                                                |
| 87           | Dynamiet v Google                       | `26db37613c6ee0d` | Match the old unsourced entry to ECLI:NL:RBAMS:2025:4460. This identifier does not belong to Bol.com.                    |

After a match is established, choose the surviving record ID deliberately and preserve all comments, uploaded materials and editorial content before retiring a duplicate. Do not delete either record or transfer comments merely because titles resemble each other. If these are different decisions, keep them distinct and document their relationship.

## 2. Review preserved summaries and comment requests

Owner: nominated admin, with research-partner input. Do this before treating the replacement as a fully reviewed publication dataset.

- Correct stale, automatically imported source/timeline blocks in preserved summaries. In particular, the Bol.com summary still contains the old Dynamiet/InView reference even though Bol.com's structured primary source has been corrected. Check summaries, timelines and commentary for similar contradictions with the replacement sources; do not erase authored analysis indiscriminately.
- Shorten TikTok's existing summary and review its legal claims before publishing it. Prof. R. v YouTube also remains unpublished and needs editorial approval.
- Review the naming corrections for the consumer organisation, Berlin, Munich and Hamburg cases, and the corrected Bol.com source. Resolve their open comments only after confirming the changes against the ruling.
- Confirm DRI's party identity and the date of the PDF linked in workbook row 16: its filename says `Beschluss`, while the decision reference says 13 May 2025.
- Add related-decision cross-references for the three DRI entries, the two Bits of Freedom entries, the two Brzoska entries and the two Audi/Fruugo entries. Distinguish decisions by court, date and reference. A related decision is not necessarily a judicial citation; do not misuse citation fields.
- Agree on consistent source-based anonymisation. One Uberspace comment has ambiguous wording about including “case” in titles; clarify it rather than assuming the intended instruction.
- Leave the test comment and the two resolved comments as history unless the editor separately requests cleanup. One resolved Bol.com comment contains the wrong-case URL; do not reuse that URL as evidence.

## 3. Fill and verify source data

Owner: research partner supplies the evidence; nominated admin applies the corrections.

- Fill six missing categories and two missing DSA-provision classifications where the source supports them. Themes are no longer used in the interface and do not need to be completed. Leave unknowns explicitly unknown; do not invent classifications.
- Find primary materials for rows 17, 19, 22, 23, 26 and 27, which still lack a primary-source URL after writs were reclassified. The workbook initially had eight primary-source gaps; linked writs supplied two of them.
- Obtain decision/filing references for rows 19 and 21–24. The column labelled ECLI contains mixed ECLI, docket and other references; genuine ECLI values are stored separately, and the original reference is retained in editorial notes.
- Verify remaining source links, their decision dates, procedural stages and legal provisions. Prefer official sources when available; some entries still use private databases or externally hosted PDFs. The migration did not independently certify every underlying ruling or link's availability.
- Review writs moved from the secondary-source column to primary sources at rows 14, 20, 21 and 24. Their labels and embedded hyperlinks were retained.
- Standardise category and DSA-provision casing. Keep recitals, general DSA references and Article 14 of the e-Commerce Directive distinct from numbered DSA articles.
- Review the party arrays for multi-party litigation: the import conservatively retained each side of the title, rather than guessing every individual legal entity.
- Populate filing dates, decision dates, court levels, outcomes and accurate procedural status from verified documents. Blank dates and `review` are not findings about a case's legal status.

## 4. Decide the treatment of historical records

Owner: project/editorial lead, with changes applied by an admin. The 18 archived records remain available only to admins; archiving is not a determination that a case lacks research value.

- Review the omitted Telegram, Travis Brown/HateAid, German SOMI, SIN, LaLiga/internet-provider, Digital Revolution and online-contact-ban entries. Decide which belong outside this replacement dataset and whether a separate non-DSA or contextual collection is appropriate.
- Keep the Barrière production appeal distinct from the replacement first-instance decision. The original appeal summary was retained privately, not reassigned to the different decision.
- Review the mislabelled “Jort Kelder” entry: its source points to the Vignette & Visa docket, not the new anonymous Google appeal.
- Keep the historical “Reclame Code Commissie” record and its two comments separate from the new RCC decision. The historical comments concern ECLI:NL:RBNNE:2025:5704; the new source is RCC file 2024/00659 involving Foodwatch, Amazon and British Good's. Confirm the precise party-based title and whether this non-court decision fits the public scope.
- Treat the old omnibus “Other decisions” record as research notes, not one judicial decision. Some of its underlying decisions now have separate entries.
- Do not publish the workbook's interviewee, contact, meeting or notes sheets as case data. Only the DSA sheet was imported.

## 5. Resolve the remaining publication blockers

Owner: nominated admin.

The policy is to publish imported entries without identified problems, rather than hold every import for a full editorial review. Missing themes, an empty summary or use of a non-ECLI court reference do not alone block publication. The 21 entries published on 1 October have an identified decision, a primary-source link, classification and legal basis, with no unresolved identity or scope flag. This is not a claim that every underlying ruling or link has been independently certified. Admins can unpublish an entry later if an issue is discovered; authors without an admin role should send the issue to a nominated admin.

Sixteen entries remain unpublished:

- Seven uncertain identities in section 1.
- Row 17 (DRI first-instance decision) and row 26 (Brzoska first-instance decision): missing primary-source links.
- Row 23 (Massaschade & Consument v Snap): missing primary source, reference, category and legal basis.
- Row 24 (SOMI v Snap): a primary writ is linked, but a case/filing reference still needs confirmation.
- Rows 76 and 77 (Bhblasted and Farina): missing categories.
- Row 88 (RCC): unresolved party-based title and scope.
- TikTok and Prof. R. v YouTube: prior unpublished state retained; resolve their existing editorial review separately.

Publish each remaining entry when its specific blocker is resolved. Do not reinstate archived predecessors or transfer their comments without confirming identity.

## Recovery and verification

The production changes were committed in one PocketBase batch transaction. A full server backup was created first: `dsa-replacement-20260930t200634z.zip`. Batch API settings were restored afterward.

A downloaded, ZIP-integrity-checked backup, original snapshots, source workbook, reviewed plans, application receipt, post-application snapshots and rollback proposals are retained privately outside Git at:

`~/Library/Application Support/DSA Case Tracker/migrations/2026-09-30/`

Keep that directory private: the full backup contains database/authentication data. Do not attach it to issues or commit it. The application receipt and `verification.json` are in its `production-application/` subdirectory.

Post-application verification confirmed every submitted payload, preserved fields, all 20 comments and their case associations/resolution states, 79 active entries, 18 archived entries, 42 published entries, 37 unpublished entries, and restored batch settings. The initial verification used an incorrect fixed publication count; it was corrected to derive the count from the original records, and verification was rerun read-only without repeating the migration.

The 1 October publication update used a separate atomic batch changing only `published` on 21 entries. Before it, a new server backup was verified: `dsa-publication-20261001t134731z.zip`. Read-back confirmed 63 public entries, 16 unpublished active entries, 18 archived histories, unchanged content and all 20 comments unchanged. Batch settings were restored. Private before/after snapshots, selection reasons, publication receipt and visibility-only rollback proposals are in `~/Library/Application Support/DSA Case Tracker/migrations/2026-10-01-publication/`.

Case access was restricted on 1 October: only explicit admin accounts can manage cases or read unpublished/archived records. Ordinary signed-in users see the same published cases as anonymous visitors. Users cannot grant themselves admin status through registration or profile updates, and uploaded case files are protected. Live permission checks used temporary validation records, which were removed afterward; all 97 existing cases and 20 comments were unchanged. Private schema snapshots, backup metadata and verification evidence are in `~/Library/Application Support/DSA Case Tracker/migrations/2026-10-01-admin-permissions/`.

The rollback file is a recovery proposal, not an automatic operation. It restores original records and hides newly created entries rather than deleting them. Before any recovery, export current data and review intervening edits. Restoring the full server backup would also revert unrelated changes made after the backup and requires explicit approval.

Do not rerun the original application command against the changed database. Future imports need fresh snapshots, an updated reviewed mapping and a new plan.
