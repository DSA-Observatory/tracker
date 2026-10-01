#!/usr/bin/env python3
"""Build a private, review-only replacement plan from the DSA workbook."""

import argparse
import csv
import hashlib
import json
import os
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote
from zipfile import ZipFile


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
OUTPUT_NAMES = ("normalized-cases.json", "migration-plan.json", "migration-review.csv")
WRIT_ROWS = {14, 20, 21, 24}
REPLACEMENT_FIELDS = (
    "title",
    "jurisdiction",
    "provisions",
    "categories",
    "themes",
    "court",
    "primary_sources",
    "secondary_sources",
)
PRESERVED_FIELDS = (
    "id",
    "case_id",
    "published",
    "status",
    "summary",
    "timeline",
    "filing_date",
    "decision_date",
)


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def normalized_header(value):
    return re.sub(r"[^a-z0-9]+", " ", clean(value).lower()).strip()


def column_index(cell_ref):
    match = re.match(r"([A-Z]+)", cell_ref)
    if not match:
        raise ValueError(f"Malformed cell reference: {cell_ref!r}")
    result = 0
    for char in match.group(1):
        result = result * 26 + ord(char) - 64
    return result - 1


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_part(base_part, target):
    if target.startswith("/"):
        return posixpath.normpath(target.lstrip("/"))
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_part), target))


def relationship_map(zf, rels_part):
    root = ET.fromstring(zf.read(rels_part))
    return {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in root.findall("package_rel:Relationship", NS)
    }


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(".//main:t", NS))
        for item in root.findall("main:si", NS)
    ]


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", NS)
    inline = cell.find("main:is", NS)
    if cell_type == "s" and value is not None:
        return shared_strings[int(value.text)]
    if cell_type == "inlineStr" and inline is not None:
        return "".join(node.text or "" for node in inline.findall(".//main:t", NS))
    return value.text or "" if value is not None else ""


def find_dsa_sheet(zf):
    workbook_part = "xl/workbook.xml"
    workbook = ET.fromstring(zf.read(workbook_part))
    relations = relationship_map(zf, "xl/_rels/workbook.xml.rels")
    for sheet in workbook.findall("main:sheets/main:sheet", NS):
        if sheet.attrib.get("name") == "DSA":
            relation_id = sheet.attrib[f"{{{NS['office_rel']}}}id"]
            return resolve_part(workbook_part, relations[relation_id])
    raise ValueError("Workbook does not contain a DSA sheet")


def sheet_hyperlinks(zf, sheet_part, root):
    rels_part = posixpath.join(
        posixpath.dirname(sheet_part), "_rels", posixpath.basename(sheet_part) + ".rels"
    )
    relations = relationship_map(zf, rels_part) if rels_part in zf.namelist() else {}
    result = {}
    for hyperlink in root.findall(".//main:hyperlinks/main:hyperlink", NS):
        ref = hyperlink.attrib.get("ref", "")
        if ":" in ref or not re.fullmatch(r"[A-Z]+[0-9]+", ref):
            raise ValueError(f"Unsupported or malformed hyperlink reference: {ref!r}")
        if ref in result:
            raise ValueError(f"Duplicate hyperlink reference: {ref}")
        relation_id = hyperlink.attrib.get(f"{{{NS['office_rel']}}}id")
        target = relations.get(relation_id, hyperlink.attrib.get("location", ""))
        if relation_id and relation_id not in relations:
            raise ValueError(f"Hyperlink {ref} has unknown relationship {relation_id}")
        result[ref] = target
    return result


def map_headers(cells):
    headers = {normalized_header(value): index for index, value in cells.items() if clean(value)}

    def locate(prefix):
        matches = [index for header, index in headers.items() if header.startswith(prefix)]
        if len(matches) != 1:
            raise ValueError(f"Expected one header beginning {prefix!r}, found {len(matches)}")
        return matches[0]

    return {
        "title": locate("case name"),
        "jurisdiction": locate("country"),
        "provisions": locate("dsa provisions"),
        "categories": locate("category"),
        "themes": locate("theme"),
        "court": locate("instance"),
        "primary": locate("primary sources"),
        "secondary": locate("secondary sources"),
        "reference": locate("ecli"),
    }


def extract_ecli(*values):
    for value in values:
        decoded = unquote(str(value or ""))
        match = re.search(r"(?<![A-Z0-9])ECLI:[A-Z]{2}:[A-Z0-9.]+:\d{4}:[A-Z0-9.]+", decoded, re.I)
        if match:
            return match.group(0).rstrip(".").upper()
    return ""


def split_classification(value):
    return [clean(part) for part in re.split(r"\s*[;,]\s*", clean(value)) if clean(part)]


def parse_provisions(value):
    literal = clean(value)
    parts = split_classification(literal)
    articles = []
    recitals = []
    other = []
    for part in parts:
        article = re.fullmatch(r"Article\s+(\d+[a-z]?)\s+DSA", part, re.I)
        recital = re.fullmatch(r"Recital\s+(\d+[a-z]?)\s+DSA", part, re.I)
        if article:
            canonical = f"Article {article.group(1)} DSA"
            if canonical not in articles:
                articles.append(canonical)
        elif recital:
            recitals.append(f"Recital {recital.group(1)} DSA")
        elif part:
            other.append(part)
    return literal, articles, recitals, other


def parse_parties(title):
    parts = re.split(r"\s+v\.?\s+", clean(title), maxsplit=1, flags=re.I)
    if len(parts) != 2:
        return {"plaintiffs": [], "defendants": [], "method": "not_parsed"}
    return {
        "plaintiffs": [parts[0]],
        "defendants": [parts[1]],
        "method": "conservative_title_split",
    }


def source_entry(cell_ref, label, hyperlink):
    text = clean(label)
    target = clean(hyperlink)
    if not target:
        url_match = re.search(r"https?://\S+", text)
        target = url_match.group(0).rstrip(").,]”)" ) if url_match else ""
    if not target:
        return []
    return [{"label": text or target, "url": target, "source_cell": cell_ref}]


def parse_workbook(path):
    with ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheet_part = find_dsa_sheet(zf)
        root = ET.fromstring(zf.read(sheet_part))
        hyperlinks = sheet_hyperlinks(zf, sheet_part, root)
        rows = {}
        for row in root.findall(".//main:sheetData/main:row", NS):
            row_number = int(row.attrib["r"])
            values = {}
            refs = {}
            for cell in row.findall("main:c", NS):
                ref = cell.attrib.get("r", "")
                index = column_index(ref)
                if index in values:
                    raise ValueError(f"Duplicate cell column in workbook row {row_number}")
                values[index] = cell_value(cell, shared_strings)
                refs[index] = ref
            rows[row_number] = (values, refs)

        if 12 not in rows:
            raise ValueError("DSA header row 12 is missing")
        headers = map_headers(rows[12][0])
        records = []
        for row_number in sorted(number for number in rows if number > 12):
            values, refs = rows[row_number]
            title = clean(values.get(headers["title"], ""))
            if not title:
                continue
            raw = {name: clean(values.get(index, "")) for name, index in headers.items()}
            primary_ref = refs.get(headers["primary"], f"G{row_number}")
            secondary_ref = refs.get(headers["secondary"], f"H{row_number}")
            primary = source_entry(primary_ref, raw["primary"], hyperlinks.get(primary_ref, ""))
            secondary = source_entry(secondary_ref, raw["secondary"], hyperlinks.get(secondary_ref, ""))
            warnings = []
            if row_number in WRIT_ROWS and secondary:
                for source in secondary:
                    source["reclassified_from"] = "secondary_sources"
                    source["reclassification_reason"] = "Writ/court filing is a primary source"
                primary.extend(secondary)
                secondary = []
                warnings.append("Writ reclassified from the workbook's secondary column to primary sources")
            legal_basis, dsa_articles, recitals, other_legal = parse_provisions(raw["provisions"])
            ecli = extract_ecli(raw["reference"], *(item["url"] for item in primary))
            if raw["reference"] and not ecli:
                warnings.append("The ECLI-labelled cell is a non-ECLI decision reference; it was not put in ecli")
            if not primary:
                warnings.append("Primary source URL is missing")
            if not raw["reference"]:
                warnings.append("Decision reference is missing")
            if not raw["provisions"]:
                warnings.append("Legal provisions are blank and therefore form an explicit clearing proposal")
            if not raw["categories"]:
                warnings.append("Categories are blank and therefore form an explicit clearing proposal")
            if not raw["themes"]:
                warnings.append("Themes are blank and therefore form an explicit clearing proposal")
            procedural_instance = any(
                term in raw["court"].lower()
                for term in ("proceedings", "pending", "withdrawn", "settlement", "settled")
            )
            if procedural_instance:
                warnings.append("Instance contains procedural wording; retained separately, not proposed as a court or inferred status")
            if row_number == 16:
                warnings.append(
                    "Verify that the linked DRI PDF labelled Beschluss is the 13 May 2025 decision identified in the workbook"
                )
            records.append(
                {
                    "workbook_row": row_number,
                    "source_reference": f"DSA!A{row_number}",
                    "title": title,
                    "jurisdiction": raw["jurisdiction"],
                    "legal_basis": legal_basis,
                    "dsa_articles": dsa_articles,
                    "dsa_recitals": recitals,
                    "other_legal_references": other_legal,
                    "categories": split_classification(raw["categories"]),
                    "themes": split_classification(raw["themes"]),
                    "court": "" if procedural_instance else raw["court"],
                    "procedural_wording": raw["court"] if procedural_instance else "",
                    "decision_reference": raw["reference"],
                    "ecli": ecli,
                    "parties": parse_parties(title),
                    "primary_sources": primary,
                    "secondary_sources": secondary,
                    "source_metadata": {
                        "workbook_primary_text": raw["primary"],
                        "workbook_secondary_text": raw["secondary"],
                    },
                    "new_record_defaults": {"published": False, "status": "review"},
                    "warnings": warnings,
                }
            )
    return records, len(hyperlinks)


def read_json_list(path, label):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{label} snapshot must be a JSON list")
    return data


def unique_index(items, field, label):
    result = {}
    for item in items:
        value = clean(item.get(field))
        if not value:
            raise ValueError(f"{label} contains a record without {field}")
        if value in result:
            raise ValueError(f"{label} contains duplicate {field}: {value}")
        result[value] = item
    return result


def load_matches(path, workbook_rows, production_ids):
    with Path(path).open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {"row", "production_id", "assessment", "notes", "primary_url", "identifier"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Match CSV is missing columns: {', '.join(sorted(missing))}")
        result = {}
        used_production_ids = set()
        for item in reader:
            row_text = clean(item.get("row"))
            if not row_text.isdigit():
                raise ValueError(f"Malformed workbook row reference in match CSV: {row_text!r}")
            row = int(row_text)
            if row in result:
                raise ValueError(f"Duplicate workbook row reference in match CSV: {row}")
            if row not in workbook_rows:
                raise ValueError(f"Match CSV references unknown workbook row: {row}")
            production_id = clean(item.get("production_id"))
            if production_id and production_id not in production_ids:
                raise ValueError(f"Match CSV row {row} references unknown production ID: {production_id}")
            if production_id in used_production_ids:
                raise ValueError(f"Duplicate production ID in match CSV: {production_id}")
            if production_id:
                used_production_ids.add(production_id)
            result[row] = {key: clean(value) for key, value in item.items()}
    if set(result) != set(workbook_rows):
        missing_rows = sorted(set(workbook_rows) - set(result))
        raise ValueError(f"Match CSV does not cover every workbook row; missing: {missing_rows}")
    return result


def load_comment_audit(path, comment_ids):
    if not path:
        return {}
    with Path(path).open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {"comment_id", "assessment", "notes"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Comment audit CSV is missing columns: {', '.join(sorted(missing))}")
        result = {}
        for item in reader:
            comment_id = clean(item.get("comment_id"))
            if comment_id not in comment_ids:
                raise ValueError(f"Comment audit references unknown comment ID: {comment_id}")
            if comment_id in result:
                raise ValueError(f"Comment audit contains duplicate comment ID: {comment_id}")
            result[comment_id] = {
                "assessment": clean(item.get("assessment")),
                "notes": clean(item.get("notes")),
            }
    if set(result) != comment_ids:
        missing_ids = sorted(comment_ids - set(result))
        raise ValueError(f"Comment audit does not cover every comment; missing: {missing_ids}")
    return result


def scalar_urls(value):
    text = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    return {match.rstrip(").,]”)" ) for match in re.findall(r"https?://[^\s\"']+", text)}


def exact_identity_evidence(record, match, production):
    workbook_urls = {item["url"] for item in record["primary_sources"]}
    production_urls = set()
    for field in ("primary_sources", "document_links", "documents"):
        production_urls.update(scalar_urls(production.get(field)))
    workbook_ecli = record["ecli"]
    production_ecli = extract_ecli(production.get("ecli"), production.get("case_id"))
    exact_url = bool(workbook_urls & production_urls)
    exact_ecli = bool(workbook_ecli and production_ecli and workbook_ecli == production_ecli)
    exact_identifier = bool(
        clean(match.get("identifier"))
        and clean(match.get("identifier")).lower() in json.dumps(production, ensure_ascii=False).lower()
    )
    return {
        "exact_primary_url": exact_url,
        "exact_ecli": exact_ecli,
        "exact_identifier_text": exact_identifier,
        "has_exact_source_or_identifier": exact_url or exact_ecli or exact_identifier,
    }


def proposed_values(record):
    return {
        "title": record["title"],
        "jurisdiction": record["jurisdiction"],
        "provisions": {
            "legal_basis_literal": record["legal_basis"],
            "dsa_articles": record["dsa_articles"],
            "dsa_recitals": record["dsa_recitals"],
            "other_legal_references": record["other_legal_references"],
        },
        "categories": record["categories"],
        "themes": record["themes"],
        "court": record["court"],
        "primary_sources": record["primary_sources"],
        "secondary_sources": record["secondary_sources"],
    }


def is_clearing_proposal(field, value):
    if field == "provisions":
        return not value["legal_basis_literal"]
    return value in ("", [])


def current_value(production, field):
    if field == "provisions":
        return {
            "legal_basis_literal": production.get("legal_basis"),
            "dsa_articles": production.get("dsa_articles"),
        }
    return production.get(field)


def sanitized_comment(comment, audit):
    result = {
        "id": comment["id"],
        "production_case_id": comment["case"],
        "content": comment.get("content", ""),
        "resolved": bool(comment.get("resolved", False)),
        "resolved_at": comment.get("resolved_at", ""),
        "created": comment.get("created", ""),
        "updated": comment.get("updated", ""),
        "disposition": "retain_on_current_production_case_without_auto_resolution",
    }
    if comment["id"] in audit:
        result["audit"] = audit[comment["id"]]
    return result


def build_plan(records, matches, cases, comments, comment_audit, fingerprints, hyperlink_count):
    cases_by_id = unique_index(cases, "id", "Production cases snapshot")
    comments_by_id = unique_index(comments, "id", "Production comments snapshot")
    for comment in comments:
        if clean(comment.get("case")) not in cases_by_id:
            raise ValueError(f"Comment {comment['id']} references unknown production case {comment.get('case')}")
    audit = load_comment_audit(comment_audit, set(comments_by_id))
    comments_by_case = {}
    retained_comments = []
    for comment in comments:
        sanitized = sanitized_comment(comment, audit)
        retained_comments.append(sanitized)
        comments_by_case.setdefault(comment["case"], []).append(comment["id"])

    proposals = []
    matched_ids = set()
    for record in records:
        match = matches[record["workbook_row"]]
        production_id = match["production_id"]
        production = cases_by_id.get(production_id)
        blockers = []
        warnings = list(record["warnings"])
        if production:
            matched_ids.add(production_id)
            candidate = match["assessment"].startswith("Candidate match")
            evidence = exact_identity_evidence(record, match, production)
            if candidate:
                action = "unresolved_candidate_replacement"
                blockers.append("Candidate identity is unresolved and must be explicitly approved before any replacement")
            else:
                action = "reviewed_replacement_proposal"
                if not evidence["has_exact_source_or_identifier"]:
                    warnings.append(
                        "Manual mapping has no exact source/identifier overlap with the production snapshot; do not treat it as strong identity"
                    )
            fields = proposed_values(record)
            field_diffs = [
                {
                    "field": field,
                    "current": current_value(production, field),
                    "proposed": fields[field],
                    "clearing_proposal": is_clearing_proposal(field, fields[field]),
                    "changed": current_value(production, field) != fields[field],
                }
                for field in REPLACEMENT_FIELDS
            ]
            preserved = {field: production.get(field) for field in PRESERVED_FIELDS}
        else:
            action = "separate_new_record_proposal"
            evidence = None
            fields = proposed_values(record)
            field_diffs = [
                {
                    "field": field,
                    "current": None,
                    "proposed": fields[field],
                    "clearing_proposal": is_clearing_proposal(field, fields[field]),
                    "changed": True,
                }
                for field in REPLACEMENT_FIELDS
            ]
            preserved = {"published": False, "status": "review"}
            warnings.append(
                "Separate/new means no reviewed production mapping; it is not a confidence-certified net-new case"
            )
        for field in REPLACEMENT_FIELDS:
            if is_clearing_proposal(field, fields[field]):
                warnings.append(
                    f"Blank workbook {field} is an explicit clearing proposal requiring reviewer approval"
                )
        if record["workbook_row"] == 28:
            warnings.append(
                "Barrière first instance RG 24/02349 is distinct from the retained production appeal RG 24/12568; do not reuse its ID"
            )
        if record["workbook_row"] == 88:
            warnings.append(
                "This Foodwatch/Amazon/British Goods RCC decision is distinct from the retained mislabelled production RCC history"
            )
        proposals.append(
            {
                "workbook_row": record["workbook_row"],
                "source_reference": record["source_reference"],
                "title": record["title"],
                "action": action,
                "approval_required": True,
                "production_id": production_id or None,
                "production_title": production.get("title") if production else None,
                "reviewed_assessment": match["assessment"],
                "reviewed_notes": match["notes"],
                "identity_evidence": evidence,
                "field_diffs": field_diffs,
                "preserved_fields": preserved,
                "reference_metadata": {
                    "decision_reference": record["decision_reference"],
                    "extracted_ecli": record["ecli"],
                },
                "retained_comment_ids": comments_by_case.get(production_id, []),
                "blockers": blockers,
                "warnings": warnings,
            }
        )

    unmapped = []
    for case in cases:
        if case["id"] in matched_ids:
            continue
        unmapped.append(
            {
                "production_id": case["id"],
                "case_id": case.get("case_id"),
                "title": case.get("title"),
                "published": case.get("published"),
                "status": case.get("status"),
                "retained_comment_ids": comments_by_case.get(case["id"], []),
                "disposition": "retain_or_hide_only_never_delete",
            }
        )

    gap_counts = {
        "provisions_blank": sum(not record["legal_basis"] for record in records),
        "categories_blank": sum(not record["categories"] for record in records),
        "themes_blank": sum(not record["themes"] for record in records),
        "workbook_primary_source_url_missing": sum(
            not any(not source.get("reclassified_from") for source in record["primary_sources"])
            for record in records
        ),
        "normalized_primary_source_url_missing_after_writ_reclassification": sum(
            not record["primary_sources"] for record in records
        ),
        "decision_reference_missing": sum(not record["decision_reference"] for record in records),
    }
    counts = {
        "normalized_rows": len(records),
        "replacement_proposals": sum(bool(item["production_id"]) for item in proposals),
        "separate_new_proposals": sum(not item["production_id"] for item in proposals),
        "unresolved_candidate_matches": sum(item["action"].startswith("unresolved") for item in proposals),
        "retained_unmapped_histories": len(unmapped),
        "retained_comments": len(retained_comments),
        "workbook_hyperlinks": hyperlink_count,
        "hidden_secondary_hyperlinks": sum(
            source["source_cell"].startswith("H")
            and bool(source["url"])
            and not record["source_metadata"]["workbook_secondary_text"].startswith("http")
            for record in records
            for source in record["primary_sources"] + record["secondary_sources"]
        ),
    }
    plan = {
        "format": "dsa-replacement-review-plan-v1",
        "read_only": True,
        "applicable": False,
        "notice": "This artifact cannot write to PocketBase and contains no apply operation.",
        "counts": counts,
        "source_schema_gaps": gap_counts,
        "fingerprints": fingerprints,
        "eventual_application_requirements": [
            "Obtain explicit approval for every proposal and separately resolve all candidate matches.",
            "Re-export production snapshots immediately before application and compare their SHA-256 fingerprints.",
            "Implement application separately; this planner intentionally has no network, authentication, or write path.",
            "Take a full cases/comments/database backup and use one rollback-capable transaction.",
            "Retain or hide unmapped histories; never cascade-delete them or their comments.",
        ],
        "critical_safeguards": [
            "Preserve IDs, case IDs, publication state, status, summaries, timelines, filing dates, and decision dates on mapped records.",
            "Do not infer court status from pending/settled wording in the instance column.",
            "Do not move comments between decisions or auto-resolve them.",
            "TikTok production publication state and reviewed summary are retained by the plan.",
            "Jort Kelder production history is not mapped to the new appellant row; the Vignette mapping remains separate.",
        ],
        "proposals": proposals,
        "retained_unmapped_histories": unmapped,
        "retained_comments": retained_comments,
    }
    return plan


def review_csv(plan):
    columns = [
        "workbook_row",
        "title",
        "action",
        "production_id",
        "production_title",
        "assessment",
        "approval_required",
        "blockers",
        "warnings",
        "retained_comment_count",
    ]
    rows = []
    for proposal in plan["proposals"]:
        rows.append(
            {
                "workbook_row": proposal["workbook_row"],
                "title": proposal["title"],
                "action": proposal["action"],
                "production_id": proposal["production_id"] or "",
                "production_title": proposal["production_title"] or "",
                "assessment": proposal["reviewed_assessment"],
                "approval_required": "yes",
                "blockers": " | ".join(proposal["blockers"]),
                "warnings": " | ".join(proposal["warnings"]),
                "retained_comment_count": len(proposal["retained_comment_ids"]),
            }
        )
    import io

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def validate_paths(args):
    inputs = [Path(args.xlsx), Path(args.cases), Path(args.comments), Path(args.matches)]
    if args.comment_audit:
        inputs.append(Path(args.comment_audit))
    resolved_inputs = []
    for path in inputs:
        resolved = path.expanduser().resolve()
        if not resolved.is_file():
            raise ValueError(f"Input file does not exist: {resolved}")
        resolved_inputs.append(resolved)
    out_dir = Path(args.out_dir).expanduser().resolve()
    if out_dir.exists() and not out_dir.is_dir():
        raise ValueError(f"Output path is not a directory: {out_dir}")
    if out_dir in {path.parent for path in resolved_inputs}:
        raise ValueError("Output directory must not be an input file's directory")
    targets = [out_dir / name for name in OUTPUT_NAMES]
    collisions = [target for target in targets if target in resolved_inputs or target.exists()]
    if collisions:
        raise ValueError("Refusing to overwrite input or existing output: " + ", ".join(map(str, collisions)))
    return resolved_inputs, out_dir, targets


def write_private_outputs(out_dir, targets, contents):
    out_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(out_dir, 0o700)
    created = []
    try:
        for target, content in zip(targets, contents):
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as output:
                output.write(content)
            os.chmod(target, 0o600)
            created.append(target)
    except Exception:
        for target in created:
            target.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Create a private, read-only review plan for replacing cases from the DSA XLSX sheet."
    )
    parser.add_argument("xlsx", help="Source .xlsx workbook (read only)")
    parser.add_argument("--cases", required=True, help="Production cases JSON snapshot")
    parser.add_argument("--comments", required=True, help="Production case_comments JSON snapshot")
    parser.add_argument("--matches", required=True, help="Reviewed workbook reconciliation CSV")
    parser.add_argument("--comment-audit", help="Optional reviewed comment-alignment CSV")
    parser.add_argument("--out-dir", required=True, help="Private output directory, separate from input directories")
    args = parser.parse_args()

    inputs, out_dir, targets = validate_paths(args)
    workbook, cases_path, comments_path, matches_path = inputs[:4]
    comment_audit = inputs[4] if len(inputs) == 5 else None
    records, hyperlink_count = parse_workbook(workbook)
    cases = read_json_list(cases_path, "Cases")
    comments = read_json_list(comments_path, "Comments")
    cases_by_id = unique_index(cases, "id", "Production cases snapshot")
    unique_index(comments, "id", "Production comments snapshot")
    matches = load_matches(matches_path, {item["workbook_row"] for item in records}, set(cases_by_id))
    fingerprints = {
        "workbook_sha256": sha256(workbook),
        "cases_snapshot_sha256": sha256(cases_path),
        "comments_snapshot_sha256": sha256(comments_path),
        "matches_csv_sha256": sha256(matches_path),
    }
    if comment_audit:
        fingerprints["comment_audit_csv_sha256"] = sha256(comment_audit)
    plan = build_plan(
        records, matches, cases, comments, comment_audit, fingerprints, hyperlink_count
    )
    normalized = {
        "format": "dsa-normalized-workbook-review-v1",
        "read_only": True,
        "database_payload": False,
        "source_sheet": "DSA",
        "record_count": len(records),
        "fingerprints": fingerprints,
        "records": records,
    }
    contents = [
        json.dumps(normalized, indent=2, ensure_ascii=False) + "\n",
        json.dumps(plan, indent=2, ensure_ascii=False) + "\n",
        review_csv(plan),
    ]
    write_private_outputs(out_dir, targets, contents)
    counts = plan["counts"]
    print(
        "Prepared read-only plan: "
        f"{counts['normalized_rows']} rows, {counts['replacement_proposals']} match proposals, "
        f"{counts['separate_new_proposals']} separate/new proposals, "
        f"{counts['retained_unmapped_histories']} retained histories, "
        f"{counts['retained_comments']} retained comments."
    )
    for target in targets:
        print(target)
    print("PocketBase unchanged; this planner has no apply functionality.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Planning failed: {exc}", file=sys.stderr)
        sys.exit(1)
