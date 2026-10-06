#!/usr/bin/env python3
"""Build a lossless, private, ID-preserving correction plan for the DSA sheet.

This script never authenticates or mutates a database. Snapshot input and output
must be kept private. No contact, interview, meeting or notes sheets are read.
"""
import argparse
import calendar
import importlib.util
import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from zipfile import ZipFile


def planner_module():
    spec = importlib.util.spec_from_file_location("dsa_planner", Path(__file__).with_name("plan-cases-replacement.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


P = planner_module()
MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_name) if name}
MONTHS.update({name.lower(): i for i, name in enumerate(calendar.month_abbr) if name})
MONTHS.update(dict(zip(("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"), range(1, 13))))
MONTHS.update({"janv": 1, "févr": 2, "avr": 4, "juil": 7, "sept": 9, "oct": 10, "nov": 11, "déc": 12})


def extract_reference_date(reference):
    """Extract only complete explicit reference dates; never ECLI/URL/docket years.

    Numeric tokens use the workbook's European day-month-year notation. Evidence
    records the convention and whether the token would be ambiguous in US notation.
    This is faithful transcription, not independent verification of a judgment.
    """
    found = []
    text = P.clean(reference)
    for match in re.finditer(r"(?<!\d)(\d{1,2})([.\-/])(\d{1,2})\2(\d{4})(?!\d)", text):
        day, month, year = int(match[1]), int(match[3]), int(match[4])
        try:
            value = date(year, month, day).isoformat()
        except ValueError:
            continue
        found.append((value, {"token": match[0], "notation": "day-month-year", "ambiguous_under_us_notation": day <= 12 and day != month}))
    for match in re.finditer(r"(?<!\d)(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})(?!\d)", text):
        month = MONTHS.get(match[2].lower())
        if not month:
            continue
        try:
            value = date(int(match[3]), month, int(match[1])).isoformat()
        except ValueError:
            continue
        found.append((value, {"token": match[0], "notation": "named-month", "ambiguous_under_us_notation": False}))
    for match in re.finditer(r"\b([A-Za-zÀ-ÿ]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?!\d)", text):
        month = MONTHS.get(match[1].lower())
        if not month:
            continue
        try:
            value = date(int(match[3]), month, int(match[2])).isoformat()
        except ValueError:
            continue
        found.append((value, {"token": match[0], "notation": "named-month", "ambiguous_under_us_notation": False}))
    unique = {value for value, evidence in found}
    if len(unique) != 1:
        return "", {"result": "no_explicit_date" if not unique else "conflicting_explicit_dates", "candidates": sorted(unique)}
    value, evidence = found[0]
    return value, {**evidence, "result": "explicit_reference_date", "verified_against_ruling": False}


def raw_dsa_cells(workbook):
    with ZipFile(workbook) as archive:
        strings = P.read_shared_strings(archive)
        part = P.find_dsa_sheet(archive)
        root = ET.fromstring(archive.read(part))
        rels_part = str(Path(part).parent / "_rels" / (Path(part).name + ".rels"))
        relations = P.relationship_map(archive, rels_part) if rels_part in archive.namelist() else {}
        hyperlinks = {}
        for link in root.findall(".//main:hyperlinks/main:hyperlink", P.NS):
            address = link.attrib["ref"]
            if ":" in address:
                raise ValueError("Range hyperlinks require explicit handling")
            relation_id = link.attrib.get(f"{{{P.NS['office_rel']}}}id")
            hyperlinks[address] = {"attributes": dict(link.attrib), "target": relations.get(relation_id, link.attrib.get("location", ""))}
        cells = {}
        for cell in root.findall(".//main:sheetData/main:row/main:c", P.NS):
            address = cell.attrib["r"]
            value = cell.find("main:v", P.NS)
            formula = cell.find("main:f", P.NS)
            cells[address] = {
                "address": address, "present": True, "attributes": dict(cell.attrib),
                "value": P.cell_value(cell, strings),
                "cached_raw_value": value.text if value is not None else None,
                "formula": None if formula is None else {"text": formula.text, "attributes": dict(formula.attrib)},
                "hyperlink": hyperlinks.get(address),
            }
        return cells


def addressed_cell(cells, address):
    return cells.get(address, {"address": address, "present": False, "attributes": {}, "value": "", "cached_raw_value": None, "formula": None, "hyperlink": None})


def source_strings(sources):
    return list(dict.fromkeys(item["url"] if not item["label"] or item["label"] == item["url"] else item["label"] + "\n" + item["url"] for item in sources))


def build_plan(workbook, mapping, cases):
    records, hyperlink_count = P.parse_workbook(workbook)
    cells = raw_dsa_cells(workbook)
    digest = P.sha256(workbook)
    by_id = {record["id"]: record for record in cases}
    entries = mapping["records"]
    ids_by_row = {entry["workbook_row"]: entry["new_record_id"] for entry in entries}
    if len(by_id) != len(cases) or len(ids_by_row) != len(entries):
        raise ValueError("Duplicate snapshot IDs or source-row mappings")
    if set(ids_by_row) != {record["workbook_row"] for record in records} or set(ids_by_row.values()) != set(by_id):
        raise ValueError("Live cases do not match the approved workbook-to-record mapping")
    patches, rollbacks, audit = [], [], []
    for record in records:
        row = record["workbook_row"]
        old = by_id[ids_by_row[row]]
        expected = {
            "title": record["title"], "jurisdiction": record["jurisdiction"],
            "court": record["court"], "categories": record["categories"], "themes": record["themes"],
            "legal_basis": P.split_classification(record["legal_basis"]), "dsa_articles": record["dsa_articles"],
            "ecli": record["ecli"], "primary_sources": source_strings(record["primary_sources"]),
            "secondary_sources": source_strings(record["secondary_sources"]),
            "document_links": list(dict.fromkeys(item["url"] for item in record["primary_sources"] + record["secondary_sources"])),
        }
        if any(old.get(key) != value for key, value in expected.items()):
            raise ValueError(f"Source-field drift at workbook row {row}; do not overwrite editorial work")
        raw = [addressed_cell(cells, f"{column}{row}") for column in "ABCDEFGHI"]
        reference = P.clean(raw[8]["value"])
        extracted, date_evidence = extract_reference_date(reference)
        evidence = {**date_evidence, "source_cell": f"I{row}", "source_identity_warning": row == 16}
        if old.get("decision_date"):
            raise ValueError(f"Existing decision date at row {row}; requires explicit conflict review")
        body = {
            "decision_reference": reference,
            "procedural_wording": record["procedural_wording"],
            "workbook_source": {
                "format": "dsa-workbook-row-v1", "workbook_sha256": digest, "sheet": "DSA", "row": row,
                "headers": [addressed_cell(cells, f"{column}12") for column in "ABCDEFGHI"],
                "cells": raw, "date_extraction": evidence,
                "normalization": record,
            },
        }
        if extracted:
            body["decision_date"] = extracted + " 00:00:00.000Z"
        # Preserve meaningful unlinked source text if normalization could not store it.
        for index, field in ((6, "primary_sources"), (7, "secondary_sources")):
            text = P.clean(raw[index]["value"])
            if text and text != "/" and not raw[index]["hyperlink"] and not expected[field]:
                body[field] = [text]
        url = f"/api/collections/cases/records/{old['id']}"
        patches.append({"method": "PATCH", "url": url, "body": body})
        rollbacks.append({"method": "PATCH", "url": url, "body": {key: old.get(key, None if key == "workbook_source" else "") for key in body}})
        audit.append({
            "row": row, "id": old["id"], "cell_count": len(raw),
            "populated_cells": sum(bool(cell["value"]) for cell in raw),
            "hyperlinks": sum(cell["hyperlink"] is not None for cell in raw),
            "decision_reference": reference, "decision_date": extracted,
            "date_evidence": evidence, "procedural_wording": record["procedural_wording"],
        })
    summary = {
        "cases": len(records), "source_cell_positions_preserved": len(records) * 9,
        "source_hyperlinks": hyperlink_count, "preserved_hyperlinks": sum(row["hyperlinks"] for row in audit),
        "references_preserved": sum(bool(row["decision_reference"]) for row in audit),
        "explicit_decision_dates": sum(bool(row["decision_date"]) for row in audit),
        "procedural_descriptions": sum(bool(row["procedural_wording"]) for row in audit),
        "published_changed": 0, "deleted": 0, "created": 0,
        "numeric_date_convention": "European day-month-year as used by the workbook; not independent ruling verification",
    }
    if summary["preserved_hyperlinks"] != hyperlink_count:
        raise ValueError("Workbook hyperlink coverage is incomplete")
    return {"summary": summary, "audit": audit, "requests": patches, "rollback_requests": rollbacks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", required=True)
    parser.add_argument("--mapping", required=True)
    parser.add_argument("--cases", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()
    os.umask(0o077)
    output = Path(args.out_dir).expanduser().resolve()
    repo = Path(__file__).resolve().parents[1]
    if output == repo or repo in output.parents:
        raise ValueError("Private output must be outside Git")
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    result = build_plan(Path(args.xlsx).expanduser(), json.loads(Path(args.mapping).expanduser().read_text()), json.loads(Path(args.cases).expanduser().read_text()))
    (output / "correction-plan.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    (output / "summary.json").write_text(json.dumps(result["summary"], indent=2) + "\n")
    print(json.dumps(result["summary"]))


if __name__ == "__main__":
    main()
