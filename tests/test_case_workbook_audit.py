import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("case_workbook_audit", ROOT / "scripts/audit-case-workbook.py")
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)
FIXTURE_SPEC = importlib.util.spec_from_file_location("case_replacement_fixtures", ROOT / "tests/test_cases_replacement.py")
fixtures = importlib.util.module_from_spec(FIXTURE_SPEC)
FIXTURE_SPEC.loader.exec_module(fixtures)


class ReferenceDateTests(unittest.TestCase):
    def test_european_numeric_dates_keep_interpretation_evidence(self):
        value, evidence = audit.extract_reference_date("Regional Court in Warsaw, 07.11.2024")
        self.assertEqual(value, "2024-11-07")
        self.assertTrue(evidence["ambiguous_under_us_notation"])
        self.assertFalse(evidence["verified_against_ruling"])
        self.assertEqual(audit.extract_reference_date("Warsaw Court of Appeal, 27.03.2026")[0], "2026-03-27")

    def test_named_months(self):
        for text, expected in (("17 February 2026", "2026-02-17"), ("March 11, 2026", "2026-03-11"), ("15 mai 2025", "2025-05-15"), ("17 sept. 2025", "2025-09-17")):
            with self.subTest(text=text):
                self.assertEqual(audit.extract_reference_date(text)[0], expected)

    def test_no_dates_inferred_from_ecli_or_docket(self):
        for text in ("ECLI:AT:OGH0002:2026:0060OB00221.24D.0128.000", "High Court of Ireland, [2025] IEHC 699, Record No. 2025/3613 P", "RG No. 24/02349"):
            self.assertEqual(audit.extract_reference_date(text)[0], "")

    def test_conflicting_and_invalid_dates_are_not_imported(self):
        self.assertEqual(audit.extract_reference_date("31.02.2025")[0], "")
        value, evidence = audit.extract_reference_date("01.01.2025 and 02.02.2025")
        self.assertEqual(value, "")
        self.assertEqual(evidence["result"], "conflicting_explicit_dates")


class SourcePreservationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.workbook = Path(self.tmp.name) / "source.xlsx"
        fixtures.write_xlsx_fixture(self.workbook)
        record = audit.P.parse_workbook(self.workbook)[0][0]
        self.mapping = {"records": [{"workbook_row": 14, "new_record_id": "new000000000001"}]}
        self.case = {
            "id": "new000000000001", "title": record["title"], "jurisdiction": record["jurisdiction"],
            "court": record["court"], "categories": record["categories"], "themes": record["themes"],
            "legal_basis": audit.P.split_classification(record["legal_basis"]), "dsa_articles": record["dsa_articles"],
            "ecli": record["ecli"], "primary_sources": audit.source_strings(record["primary_sources"]),
            "secondary_sources": audit.source_strings(record["secondary_sources"]),
            "document_links": [source["url"] for source in record["primary_sources"]], "decision_date": "",
        }

    def test_all_cells_and_hyperlink_labels_are_preserved(self):
        plan = audit.build_plan(self.workbook, self.mapping, [self.case])
        body = plan["requests"][0]["body"]
        raw = {cell["address"]: cell for cell in body["workbook_source"]["cells"]}
        self.assertEqual(len(raw), 9)
        self.assertEqual(raw["H14"]["value"], "Writ filing")
        self.assertEqual(raw["H14"]["hyperlink"]["target"], "https://example.test/writ")
        self.assertEqual(raw["F14"]["value"], "Proceedings pending")
        self.assertEqual(body["procedural_wording"], "Proceedings pending")
        self.assertEqual(body["decision_reference"], "ECLI:NL:RBAMS:2024:3980")
        self.assertNotIn("decision_date", body)
        self.assertNotIn("published", body)
        self.assertEqual(plan["summary"]["preserved_hyperlinks"], 1)

    def test_missing_and_blank_cell_are_distinct(self):
        cells = audit.raw_dsa_cells(self.workbook)
        self.assertTrue(audit.addressed_cell(cells, "E14")["present"])
        self.assertEqual(cells["E14"]["value"], "")
        self.assertFalse(audit.addressed_cell(cells, "J14")["present"])

    def test_edits_and_id_drift_abort(self):
        changed = copy.deepcopy(self.case)
        changed["title"] = "Editorial correction"
        with self.assertRaisesRegex(ValueError, "drift"):
            audit.build_plan(self.workbook, self.mapping, [changed])
        changed = copy.deepcopy(self.case)
        changed["id"] = "other0000000001"
        with self.assertRaisesRegex(ValueError, "mapping"):
            audit.build_plan(self.workbook, self.mapping, [changed])


if __name__ == "__main__":
    unittest.main()
