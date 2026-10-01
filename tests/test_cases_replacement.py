import copy
import importlib.util
import json
import re
import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("apply_cases_replacement", ROOT / "scripts" / "apply-cases-replacement.py")
apply = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(apply)


def record(row, reference=None, procedural=False):
    reference = reference or f"REF-{row}"
    return {
        "workbook_row": row,
        "title": f"Claimant {row} v Defendant * {row}",
        "jurisdiction": "Netherlands",
        "legal_basis": "Article 14 e-Commerce Directive; Recital 20 DSA; Article 17 DSA",
        "dsa_articles": ["Article 17 DSA"],
        "categories": [],
        "themes": [],
        "court": "" if procedural else "Rechtbank Amsterdam",
        "procedural_wording": "Proceedings pending" if procedural else "",
        "decision_reference": reference,
        "ecli": "ECLI:NL:RBAMS:2024:3980",
        "parties": {"plaintiffs": [f"Claimant {row}"], "defendants": [f"Defendant * {row}"]},
        "primary_sources": [{"label": "Decision", "url": f"https://example.test/decision/{row}", "source_cell": f"G{row}"}],
        "secondary_sources": [{"label": "Analysis", "url": f"https://example.test/analysis/{row}", "source_cell": f"H{row}"}],
        "warnings": ["Themes are blank"],
    }


def old_case(number):
    return {
        "id": f"old{number:012d}"[-15:], "case_id": f"OLD-{number}", "title": f"Old {number}",
        "published": number <= 43, "status": "review", "summary": "retained", "timeline": "retained",
        "filing_date": "", "decision_date": "", "documents": [], "document_links": ["https://old.test"],
        "citations_to": None, "cited_by": None, "editorial_notes": "old", "updated": "old-time",
    }


def approved_inputs():
    records, proposals = [], []
    for row in range(1, 80):
        action = "reviewed_replacement_proposal" if row <= 44 else ("unresolved_candidate_replacement" if row <= 51 else "separate_new_record_proposal")
        records.append(record(row, procedural=row == 45))
        proposals.append({"workbook_row": row, "title": records[-1]["title"], "action": action, "production_id": old_case(row)["id"] if row <= 44 else None})
    return records, proposals, [old_case(number) for number in range(1, 63)]


def write_xlsx_fixture(path):
    strings = [
        "Case name", "Country", "DSA provisions", "Category", "Theme", "Instance", "Primary sources", "Secondary sources", "ECLI",
        "Alice v Platform *", "Netherlands", "Article 17 DSA; Recital 20 DSA; Article 14 e-Commerce Directive", "Due diligence", "", "Proceedings pending", "https://example.test/decision", "Writ filing", "ECLI:NL:RBAMS:2024:3980",
    ]
    shared = "".join(f"<si><t>{value}</t></si>" for value in strings)
    cells = lambda row, offset: "".join(f'<c r="{column}{row}" t="s"><v>{offset + index}</v></c>' for index, column in enumerate("ABCDEFGHI"))
    sheet = (
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<sheetData><row r=\"12\">{cells(12, 0)}</row><row r=\"14\">{cells(14, 9)}</row></sheetData>"
        '<hyperlinks><hyperlink ref="H14" r:id="rId1"/></hyperlinks></worksheet>'
    )
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("xl/sharedStrings.xml", f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">{shared}</sst>')
        archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DSA" sheetId="1" r:id="rId1"/></sheets></workbook>')
        archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
        archive.writestr("xl/worksheets/_rels/sheet1.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="https://example.test/writ"/></Relationships>')


class FakePocketBase:
    def __init__(self, cases, comments, fail_backup=False, fail_batch=False, drift_on_settings=False, fail_enable_settings=False):
        self.cases, self.comments = copy.deepcopy(cases), copy.deepcopy(comments)
        self.fail_backup, self.fail_batch, self.drift_on_settings, self.fail_enable_settings = fail_backup, fail_batch, drift_on_settings, fail_enable_settings
        self.settings = {"batch": {"enabled": False, "maxRequests": 50, "timeout": 3, "maxBodySize": 0}}
        self.calls, self.backups = [], []

    def list_records(self, collection):
        return copy.deepcopy(self.cases if collection == "cases" else self.comments)

    def request(self, method, path, body=None, timeout=None):
        self.calls.append((method, path, copy.deepcopy(body)))
        if method == "GET" and path == "/api/settings":
            return copy.deepcopy(self.settings)
        if method == "PATCH" and path == "/api/settings":
            self.settings["batch"] = copy.deepcopy(body["batch"])
            if self.drift_on_settings and body["batch"]["enabled"]:
                self.cases[0]["updated"] = "drifted-after-backup"
            if self.fail_enable_settings and body["batch"]["enabled"]:
                raise RuntimeError("settings timeout")
            return copy.deepcopy(self.settings)
        if method == "POST" and path == "/api/backups":
            if not re.fullmatch(r"[a-z0-9_-]+\.zip", body["name"]):
                raise AssertionError("Backup filename must match PocketBase's allowed format")
            if self.fail_backup:
                raise RuntimeError("backup failed")
            self.backups = [{"key": body["name"], "size": 10}]
            return {"key": body["name"]}
        if method == "GET" and path == "/api/backups":
            return copy.deepcopy(self.backups)
        if method == "POST" and path == "/api/batch":
            if self.fail_batch:
                raise RuntimeError("batch failed")
            for request in body["requests"]:
                if request["method"] == "POST":
                    self.cases.append(copy.deepcopy(request["body"]))
                else:
                    case = next(item for item in self.cases if item["id"] == request["url"].rsplit("/", 1)[-1])
                    case.update(copy.deepcopy(request["body"]))
                    case["updated"] = "new-time"
            return [{"status": 200} for _ in body["requests"]]
        raise AssertionError((method, path, body))


class CasesReplacementTests(unittest.TestCase):
    def test_approved_policy_builds_44_updates_35_creates_18_archives_without_deletes(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        self.assertEqual(97, len(operations))
        self.assertEqual(44, len(reviewed))
        self.assertEqual(18, len(archived))
        self.assertEqual(35, sum(item["method"] == "POST" for item in operations))
        self.assertFalse(any(item["method"] == "DELETE" for item in operations))
        self.assertTrue(all("case_comments" not in item["url"] for item in operations))

    def test_payload_keeps_anonymisation_and_uses_scalar_sources_ecli_and_legal_basis(self):
        payload = apply.payload_for(record(1, procedural=True), old_case(1), True, "b" * 64)
        self.assertEqual("", payload["court"])
        self.assertIn("*", payload["title"])
        self.assertEqual(["Article 17 DSA"], payload["dsa_articles"])
        self.assertIn("Article 14 e-Commerce Directive", payload["legal_basis"])
        self.assertIn("Recital 20 DSA", payload["legal_basis"])
        self.assertEqual("ECLI:NL:RBAMS:2024:3980", payload["ecli"])
        self.assertTrue(all(isinstance(source, str) for source in payload["primary_sources"] + payload["secondary_sources"]))
        self.assertIn("Candidate mapping was not assumed", payload["editorial_notes"])
        self.assertEqual(["https://example.test/decision/1", "https://example.test/analysis/1"], payload["document_links"])
        self.assertNotIn("https://old.test", payload["document_links"])

    def test_private_output_rejects_repository_paths_and_symlinks_before_creation(self):
        inside = ROOT / f"private-output-{uuid.uuid4()}"
        with self.assertRaisesRegex(ValueError, "outside the repository"):
            apply.private_output_dir(inside)
        self.assertFalse(inside.exists())
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "target"
            target.mkdir()
            link = Path(directory) / "link"
            link.symlink_to(target, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink"):
                apply.private_output_dir(link)

    def test_xlsx_shared_strings_hyperlink_writ_and_provision_parsing(self):
        with tempfile.TemporaryDirectory() as directory:
            xlsx = Path(directory) / "fixture.xlsx"
            write_xlsx_fixture(xlsx)
            records, hyperlinks = apply.load_planner().parse_workbook(xlsx)
        self.assertEqual(1, hyperlinks)
        self.assertEqual(1, len(records))
        parsed = records[0]
        self.assertEqual(["Article 17 DSA"], parsed["dsa_articles"])
        self.assertEqual(["Recital 20 DSA"], parsed["dsa_recitals"])
        self.assertEqual(["Article 14 e-Commerce Directive"], parsed["other_legal_references"])
        self.assertEqual([], parsed["secondary_sources"])
        self.assertEqual("https://example.test/writ", parsed["primary_sources"][1]["url"])

    def test_target_requires_exact_https_confirmation(self):
        self.assertEqual("https://cases.example.test", apply.validated_target("https://cases.example.test", "https://cases.example.test"))
        for target, confirmation in (("http://cases.example.test", "http://cases.example.test"), ("https://localhost", "https://localhost"), ("https://a.test", "https://b.test")):
            with self.assertRaises(ValueError):
                apply.validated_target(target, confirmation)

    def test_batch_response_requires_one_http_200_per_operation(self):
        apply.confirmed_batch_response([{"status": 200}, {"status": 200}], 2)
        apply.confirmed_batch_response({"responses": [{"status": 200}, {"status": 200}]}, 2)
        with self.assertRaisesRegex(RuntimeError, "non-200"):
            apply.confirmed_batch_response({"responses": [{"status": 200}, {"status": 400}]}, 2)
        with self.assertRaisesRegex(RuntimeError, "every request"):
            apply.confirmed_batch_response({"responses": [{"status": 200}]}, 2)

    def test_input_fingerprint_mismatch_is_fail_closed_before_parsing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = {name: root / name for name in ("workbook", "cases", "comments", "matches", "audit")}
            paths["workbook"].write_bytes(b"not an xlsx")
            paths["cases"].write_text("[]", encoding="utf-8")
            paths["comments"].write_text("[]", encoding="utf-8")
            paths["matches"].write_text("row,production_id,assessment,notes,primary_url,identifier\n", encoding="utf-8")
            paths["audit"].write_text("comment_id,assessment,notes\n", encoding="utf-8")
            normalized = root / "normalized.json"
            plan = root / "plan.json"
            normalized.write_text(json.dumps({"format": "dsa-normalized-workbook-review-v1", "fingerprints": {name: "wrong" for name in apply.REQUIRED_FINGERPRINTS}}), encoding="utf-8")
            plan.write_text(json.dumps({"format": "dsa-replacement-review-plan-v1", "fingerprints": {name: "wrong" for name in apply.REQUIRED_FINGERPRINTS}}), encoding="utf-8")
            args = SimpleNamespace(normalized=normalized, plan=plan, xlsx=paths["workbook"], cases=paths["cases"], comments=paths["comments"], matches=paths["matches"], comment_audit=paths["audit"])
            with self.assertRaisesRegex(ValueError, "Input fingerprint mismatch"):
                apply.verify_plan_inputs(args)

    def test_drift_blocks_backup_settings_and_batch(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [])
        client.cases[0]["updated"] = "drifted"
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "drifted"):
                apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertFalse(any(path in {"/api/backups", "/api/settings", "/api/batch"} and method != "GET" for method, path, _ in client.calls))

    def test_backup_failure_prevents_settings_or_data_writes(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [], fail_backup=True)
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "backup failed"):
                apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertFalse(any(method == "PATCH" and path == "/api/settings" for method, path, _ in client.calls))
        self.assertFalse(any(path == "/api/batch" for _, path, _ in client.calls))

    def test_batch_failure_restores_settings_without_individual_case_writes(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [], fail_batch=True)
        before = copy.deepcopy(client.settings["batch"])
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "batch failed"):
                apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertEqual(before, client.settings["batch"])
        self.assertEqual(1, sum(path == "/api/batch" for _, path, _ in client.calls))
        self.assertFalse(any(path.startswith("/api/collections/cases/records") and path != "/api/batch" for _, path, _ in client.calls))

    def test_drift_after_backup_or_settings_blocks_batch_and_restores_settings(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [], drift_on_settings=True)
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "after backup/settings"):
                apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertFalse(client.settings["batch"]["enabled"])
        self.assertFalse(any(path == "/api/batch" for _, path, _ in client.calls))

    def test_settings_timeout_restores_if_enable_may_have_committed(self):
        records, proposals, originals = approved_inputs()
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [], fail_enable_settings=True)
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "settings timeout"):
                apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertFalse(client.settings["batch"]["enabled"])
        self.assertFalse(any(path == "/api/batch" for _, path, _ in client.calls))

    def test_visibility_verification_uses_original_state_not_a_fixed_public_count(self):
        records, proposals, originals = approved_inputs()
        for case in originals[:10]:
            case["published"] = False
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, [])
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            apply.execute_apply(client, originals, [], operations, reviewed, archived, receipt)
        self.assertEqual(33, sum(case["published"] for case in client.cases))

    def test_success_verifies_comments_unchanged_and_restores_settings(self):
        records, proposals, originals = approved_inputs()
        comments = [{"id": "comment000000001", "case": originals[0]["id"], "content": "verbatim", "resolved": False, "updated": "old"}]
        operations, reviewed, archived = apply.build_operations(records, proposals, originals, "a" * 64)
        client = FakePocketBase(originals, comments)
        with tempfile.TemporaryDirectory() as directory:
            receipt = Path(directory) / "receipt.jsonl"
            receipt.write_text("", encoding="utf-8")
            apply.execute_apply(client, originals, comments, operations, reviewed, archived, receipt)
        self.assertEqual(comments, client.comments)
        self.assertFalse(client.settings["batch"]["enabled"])
        self.assertEqual(97, len(client.cases))
        self.assertTrue(client.cases[0]["published"])
        self.assertEqual(["https://example.test/decision/1", "https://example.test/analysis/1"], client.cases[0]["document_links"])


if __name__ == "__main__":
    unittest.main()
