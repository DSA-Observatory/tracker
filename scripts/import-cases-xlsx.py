#!/usr/bin/env python3

import argparse
import hashlib
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

STATUS_MAP = {
    "decided": "decided",
    "closed": "closed",
    "published": "published",
    "draft": "draft",
    "review": "review",
    "pending": "pending",
    "on appeal": "appealed",
    "appeal": "appealed",
    "final appeal": "appealed",
    "under consideration": "pending",
    "injunction": "decided",
}

COUNTRY_ALIASES = {
    "nl": "Netherlands",
    "the netherlands": "Netherlands",
}

CASE_FIELDS = {
    "case_id",
    "title",
    "ecli",
    "filing_date",
    "decision_date",
    "status",
    "court",
    "jurisdiction",
    "plaintiffs",
    "defendants",
    "summary",
    "keywords",
    "dsa_articles",
    "document_links",
    "citations_to",
    "cited_by",
    "commentary",
    "published",
}

REQUIRED_FIELDS = {"case_id", "title", "status", "published"}
RECOMMENDED_FIELDS = {"jurisdiction", "dsa_articles", "summary"}
NON_CASE_TITLES = {
    "nl",
    "intermediary liability",
    "p2b",
    "other",
    "....",
}


def load_env(path):
    env_path = Path(path)
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


def col_to_idx(ref):
    letters = re.match(r"([A-Z]+)", ref).group(1)
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - 64
    return value - 1


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def normalize_country(value):
    country = clean(value)
    return COUNTRY_ALIASES.get(country.lower(), country)


def is_non_case_title(value):
    title = clean(value).lower()
    return title in NON_CASE_TITLES or bool(re.fullmatch(r"[.\-–—]+", title))


def slugify(value):
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value.upper()).strip("-")
    return slug[:44].strip("-") or "CASE"


def stable_case_id(title, country, ecli):
    key = "|".join([title.lower(), country.lower(), ecli.lower()])
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:8].upper()
    return f"DSA-{slugify(title)}-{digest}"[:80]


def split_list(value):
    text = clean(value)
    if not text or text.lower() in {"not available", "no dsa article explicitly mentioned"}:
        return []
    return [item.strip() for item in re.split(r",|;|\band\b|&", text) if item.strip()]


def unique(values):
    seen = set()
    out = []
    for value in values:
        item = clean(value)
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def normalize_status(value):
    text = clean(value).lower()
    if not text:
        return "review"
    for needle, status in STATUS_MAP.items():
        if needle in text:
            return status
    return "review"


def parse_parties(title):
    parts = re.split(r"\s+v\.?\s+", clean(title), maxsplit=1, flags=re.IGNORECASE)
    if len(parts) != 2:
        return [], []
    plaintiffs = unique(re.split(r"\s*/\s*|\s+and\s+|\s*&\s*", parts[0], flags=re.IGNORECASE))
    defendants = unique(re.split(r"\s*/\s*|\s+and\s+|\s*&\s*", parts[1], flags=re.IGNORECASE))
    return plaintiffs, defendants


def extract_urls(*values):
    urls = []
    for value in values:
        urls.extend(re.findall(r"https?://[^\s)\]]+", str(value or "")))
    return unique(urls)


def read_shared_strings(zf):
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall("m:si", NS):
        strings.append("".join(t.text or "" for t in si.findall(".//m:t", NS)))
    return strings


def read_sheet_rows(zf, sheet_path, shared_strings):
    root = ET.fromstring(zf.read(sheet_path))
    rows = []
    for row in root.findall(".//m:sheetData/m:row", NS):
        values = []
        for cell in row.findall("m:c", NS):
            idx = col_to_idx(cell.attrib["r"])
            while len(values) <= idx:
                values.append("")
            cell_type = cell.attrib.get("t")
            value_node = cell.find("m:v", NS)
            inline_node = cell.find("m:is", NS)
            if cell_type == "s" and value_node is not None:
                values[idx] = shared_strings[int(value_node.text)]
            elif cell_type == "inlineStr" and inline_node is not None:
                values[idx] = "".join(t.text or "" for t in inline_node.findall(".//m:t", NS))
            elif value_node is not None:
                values[idx] = value_node.text or ""
        rows.append((int(row.attrib["r"]), values))
    return rows


def get_sheet_path(zf, sheet_name):
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    relmap = {rel.attrib["Id"]: "xl/" + rel.attrib["Target"] for rel in rels.findall("rel:Relationship", NS)}
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        if sheet.attrib["name"] == sheet_name:
            return relmap[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
    raise ValueError(f"Sheet not found: {sheet_name}")


def build_summary(timeline, primary, secondary):
    sections = []
    if clean(timeline):
        sections.append(("Case timeline", timeline))
    if clean(primary):
        sections.append(("Primary sources", primary))
    if clean(secondary):
        sections.append(("Secondary sources", secondary))
    return "".join(
        f"<h3>{html.escape(title)}</h3><p>{html.escape(clean(body))}</p>" for title, body in sections
    )


def parse_cases(path, sheet_name):
    with ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheet_path = get_sheet_path(zf, sheet_name)
        rows = read_sheet_rows(zf, sheet_path, shared_strings)

    records = []
    current = None
    for row_number, row in rows:
        if row_number <= 12:
            continue
        cells = [clean(row[i] if i < len(row) else "") for i in range(10)]
        title, country, articles, category, theme, status, timeline, primary, secondary, ecli = cells
        country = normalize_country(country)

        if title and is_non_case_title(title):
            current = None
            continue

        if title:
            plaintiffs, defendants = parse_parties(title)
            current = {
                "title": title,
                "country": country,
                "ecli": ecli,
                "statuses": [status],
                "articles": split_list(articles),
                "keywords": unique([category, theme]),
                "timelines": [timeline],
                "primary_sources": [primary],
                "secondary_sources": [secondary],
                "plaintiffs": plaintiffs,
                "defendants": defendants,
            }
            records.append(current)
        elif current:
            current["statuses"].append(status)
            current["articles"].extend(split_list(articles))
            current["keywords"].extend(unique([category, theme]))
            current["timelines"].append(timeline)
            current["primary_sources"].append(primary)
            current["secondary_sources"].append(secondary)

    merged = {}
    for record in records:
        title_key = record["title"].lower()
        ecli_key = record["ecli"].lower()
        country_key = record["country"].lower()
        key = (title_key, country_key, ecli_key)

        if not country_key:
            candidates = [
                candidate_key
                for candidate_key in merged
                if candidate_key[0] == title_key and candidate_key[2] == ecli_key
            ]
            if len(candidates) == 1:
                key = candidates[0]

        if country_key:
            blank_key = (title_key, "", ecli_key)
            if blank_key in merged:
                merged[key] = merged.pop(blank_key)
                merged[key]["country"] = record["country"]

        if key not in merged:
            merged[key] = record
            continue
        target = merged[key]
        target["statuses"].extend(record["statuses"])
        target["articles"].extend(record["articles"])
        target["keywords"].extend(record["keywords"])
        target["timelines"].extend(record["timelines"])
        target["primary_sources"].extend(record["primary_sources"])
        target["secondary_sources"].extend(record["secondary_sources"])
        target["plaintiffs"].extend(record["plaintiffs"])
        target["defendants"].extend(record["defendants"])

    payloads = []
    for record in merged.values():
        timeline = "\n".join(unique(record["timelines"]))
        primary = "\n".join(unique(record["primary_sources"]))
        secondary = "\n".join(unique(record["secondary_sources"]))
        raw_status = next((status for status in record["statuses"] if clean(status)), "")
        payloads.append(
            {
                "case_id": stable_case_id(record["title"], record["country"], record["ecli"]),
                "title": record["title"],
                "ecli": record["ecli"],
                "status": normalize_status(raw_status),
                "jurisdiction": record["country"],
                "plaintiffs": unique(record["plaintiffs"]),
                "defendants": unique(record["defendants"]),
                "summary": build_summary(timeline, primary, secondary),
                "keywords": unique(record["keywords"]),
                "dsa_articles": unique(record["articles"]),
                "document_links": extract_urls(timeline, primary, secondary),
                "commentary": html.escape(secondary) if secondary else "",
                "published": True,
            }
        )

    return payloads


def validate_payloads(payloads):
    errors = []
    warnings = []
    seen_case_ids = set()

    for index, payload in enumerate(payloads, start=1):
        label = payload.get("case_id") or f"row {index}"
        unknown_fields = sorted(set(payload) - CASE_FIELDS)
        if unknown_fields:
            errors.append(f"{label}: unknown database fields: {', '.join(unknown_fields)}")

        missing_required = sorted(field for field in REQUIRED_FIELDS if payload.get(field) in (None, ""))
        if missing_required:
            errors.append(f"{label}: missing required fields: {', '.join(missing_required)}")

        missing_recommended = sorted(field for field in RECOMMENDED_FIELDS if not payload.get(field))
        if missing_recommended:
            warnings.append(f"{label}: missing recommended fields: {', '.join(missing_recommended)}")

        case_id = payload.get("case_id")
        if case_id in seen_case_ids:
            errors.append(f"{label}: duplicate case_id")
        seen_case_ids.add(case_id)

        if len(payload.get("case_id", "")) > 80:
            errors.append(f"{label}: case_id exceeds PocketBase max length")
        if len(payload.get("title", "")) > 300:
            errors.append(f"{label}: title exceeds PocketBase max length")

    return errors, warnings


def write_normalized_dataset(path, source_path, sheet_name, payloads, warnings):
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataset = {
        "source": str(source_path),
        "sheet": sheet_name,
        "record_count": len(payloads),
        "warnings": warnings,
        "records": payloads,
    }
    output_path.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n")
    return output_path


def request_json(method, url, token=None, data=None):
    body = None if data is None else json.dumps(data).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8")
        raise RuntimeError(f"{method} {url} failed: {err.code} {detail}") from err


def authenticate(base_url):
    email = os.environ.get("POCKETBASE_SUPERUSER_EMAIL") or os.environ.get("POCKETBASE_ADMIN_EMAIL")
    password = os.environ.get("POCKETBASE_SUPERUSER_PASSWORD") or os.environ.get("POCKETBASE_ADMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError("PocketBase superuser credentials are required")
    auth_data = {"identity": email, "password": password}
    try:
        return request_json("POST", f"{base_url}/api/collections/_superusers/auth-with-password", data=auth_data)["token"]
    except RuntimeError:
        auth_data = {"email": email, "password": password}
        return request_json("POST", f"{base_url}/api/admins/auth-with-password", data=auth_data)["token"]


def find_existing(base_url, token, case_id):
    filter_query = urllib.parse.quote(f'case_id = "{case_id}"')
    result = request_json(
        "GET", f"{base_url}/api/collections/cases/records?perPage=1&filter={filter_query}", token=token
    )
    items = result.get("items", [])
    return items[0] if items else None


def upsert_cases(base_url, token, payloads):
    created = 0
    updated = 0
    for payload in payloads:
        existing = find_existing(base_url, token, payload["case_id"])
        if existing:
            request_json("PATCH", f"{base_url}/api/collections/cases/records/{existing['id']}", token=token, data=payload)
            updated += 1
        else:
            request_json("POST", f"{base_url}/api/collections/cases/records", token=token, data=payload)
            created += 1
    return created, updated


def list_managed_cases(base_url, token):
    items = []
    page = 1
    while True:
        result = request_json(
            "GET",
            f"{base_url}/api/collections/cases/records?page={page}&perPage=200&filter={urllib.parse.quote('case_id ~ "DSA-"')}",
            token=token,
        )
        items.extend(result.get("items", []))
        if page >= result.get("totalPages", 1):
            return items
        page += 1


def delete_stale_managed_cases(base_url, token, expected_case_ids):
    deleted = 0
    for record in list_managed_cases(base_url, token):
        if record.get("case_id") in expected_case_ids:
            continue
        request_json("DELETE", f"{base_url}/api/collections/cases/records/{record['id']}", token=token)
        deleted += 1
    return deleted


def main():
    parser = argparse.ArgumentParser(description="Normalize and optionally import DSA case records into PocketBase.")
    parser.add_argument("xlsx", help="Path to the .xlsx workbook")
    parser.add_argument("--sheet", default="DSA")
    parser.add_argument("--env", default=".env")
    parser.add_argument("--target-url", default=None)
    parser.add_argument("--out", default="data/normalized-cases.json")
    parser.add_argument("--apply", action="store_true", help="Write normalized records to PocketBase")
    parser.add_argument(
        "--replace-managed",
        action="store_true",
        help="Delete generated DSA-* records that are absent from the normalized workbook output",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate only; do not write JSON or PocketBase")
    args = parser.parse_args()

    load_env(args.env)
    base_url = (args.target_url or os.environ.get("POCKETBASE_TARGET_URL") or os.environ.get("POCKETBASE_PROD_URL") or os.environ.get("PUBLIC_POCKETBASE_URL") or "http://localhost:8095").rstrip("/")
    source_path = Path(args.xlsx)
    payloads = parse_cases(source_path, args.sheet)
    errors, warnings = validate_payloads(payloads)

    print(f"Parsed {len(payloads)} merged case records from sheet {args.sheet}.")
    for payload in payloads[:5]:
        print(f"- {payload['case_id']}: {payload['title']} [{payload['status']}]")

    print(f"Validation: {len(errors)} errors, {len(warnings)} warnings.")
    for warning in warnings[:10]:
        print(f"Warning: {warning}")
    if len(warnings) > 10:
        print(f"Warning: {len(warnings) - 10} additional warnings written to normalized output.")

    if errors:
        for error in errors:
            print(f"Error: {error}", file=sys.stderr)
        raise RuntimeError("Validation failed; database import blocked.")

    if args.dry_run:
        return

    output_path = write_normalized_dataset(args.out, source_path, args.sheet, payloads, warnings)
    print(f"Normalized dataset written to {output_path}.")

    if not args.apply:
        print("Database unchanged. Re-run with --apply after reviewing the normalized dataset.")
        return

    token = authenticate(base_url)
    deleted = 0
    if args.replace_managed:
        deleted = delete_stale_managed_cases(base_url, token, {payload["case_id"] for payload in payloads})
    created, updated = upsert_cases(base_url, token, payloads)
    print(f"Import complete. Created {created}, updated {updated}, deleted {deleted} stale records.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        sys.exit(1)
