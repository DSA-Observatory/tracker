#!/usr/bin/env python3
"""Safely apply the explicitly approved DSA cases replacement plan.

This is deliberately not a general PocketBase importer.  It only accepts the
review-plan shape produced by plan-cases-replacement.py and has a dry-run
default.  No record is ever deleted and case comments are never a write target.
"""

import argparse
import hashlib
import html
import importlib.util
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
REQUIRED_FINGERPRINTS = {
    "workbook_sha256",
    "cases_snapshot_sha256",
    "comments_snapshot_sha256",
    "matches_csv_sha256",
    "comment_audit_csv_sha256",
}
SYSTEM_FIELDS = {"id", "collectionId", "collectionName", "created", "updated"}


def fail(message):
    raise ValueError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"Cannot read {label}: {exc}")


def existing_file(value, label):
    path = Path(value).expanduser()
    if path.is_symlink() or not path.is_file():
        fail(f"{label} must be a regular file: {path}")
    return path.resolve(strict=True)


def private_output_dir(value):
    path = Path(value).expanduser()
    if path.is_symlink() or any(part.is_symlink() for part in (path, *path.parents)):
        fail("Output directory may not be a symlink")
    resolved = path.resolve()
    try:
        resolved.relative_to(REPO_ROOT)
    except ValueError:
        pass
    else:
        fail("Output directory must be outside the repository")
    if resolved.exists():
        if not resolved.is_dir() or any(resolved.iterdir()):
            fail("Output directory must be a new or empty private directory")
    else:
        resolved.mkdir(parents=True, mode=0o700)
    os.chmod(resolved, 0o700)
    return resolved


def write_private(path, value):
    data = canonical(value) + "\n"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())
    os.chmod(path, 0o600)


def append_receipt(path, event, **details):
    entry = {"at": datetime.now(UTC).isoformat(), "event": event, **details}
    with path.open("a", encoding="utf-8") as output:
        output.write(canonical(entry) + "\n")
        output.flush()
        os.fsync(output.fileno())


def load_planner():
    location = REPO_ROOT / "scripts" / "plan-cases-replacement.py"
    spec = importlib.util.spec_from_file_location("cases_replacement_planner", location)
    if not spec or not spec.loader:
        fail("Cannot load replacement planner for normalization verification")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def split_legal_basis(value):
    return [part.strip() for part in re.split(r"\s*[;,]\s*", str(value or "").strip()) if part.strip()]


def source_strings(sources):
    result = []
    for source in sources:
        if not isinstance(source, dict):
            fail("Normalized source entry must be an object")
        label = str(source.get("label") or "").strip()
        url = str(source.get("url") or "").strip()
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            fail(f"Normalized source URL is not HTTP(S): {url!r}")
        item = url if label == url or not label else f"{label}\n{url}"
        if item not in result:
            result.append(item)
    return result


def url_list(sources):
    return list(dict.fromkeys(str(item["url"]).strip() for item in sources if item.get("url")))


def provenance_note(record, candidate=False):
    flags = list(record.get("warnings") or [])
    if record.get("procedural_wording"):
        flags.append(f"Procedural wording retained without court/status inference: {record['procedural_wording']}")
    if not record.get("categories"):
        flags.append("Workbook categories were blank")
    if not record.get("themes"):
        flags.append("Workbook themes were blank")
    if candidate:
        flags.append("Candidate mapping was not assumed to be the same decision; this is a new provisional record")
    escaped_flags = "; ".join(html.escape(flag, quote=True) for flag in flags) or "none"
    reference = html.escape(str(record.get("decision_reference") or ""), quote=True) or "none"
    return (
        "<p><strong>DSA replacement provenance</strong>: workbook row "
        f"{int(record['workbook_row'])}; original reference {reference}; flags: {escaped_flags}.</p>"
    )


def append_note(existing, record, candidate=False):
    return f"{str(existing or '').rstrip()}{provenance_note(record, candidate)}"


def slug(value, fallback):
    value = re.sub(r"[^A-Za-z0-9]+", "-", str(value or "").upper()).strip("-")
    return (value or fallback)[:24]


def identity(record, workbook_hash):
    primary = url_list(record.get("primary_sources") or [])
    reference = str(record.get("decision_reference") or "").strip()
    primary_url = primary[0] if primary else ""
    fallback = f"row:{record['workbook_row']}:{workbook_hash}" if not reference else ""
    return "|".join((str(record.get("jurisdiction") or ""), str(record.get("court") or ""), reference, primary_url, fallback))


def new_identifiers(record, workbook_hash):
    key = identity(record, workbook_hash)
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    reference = str(record.get("decision_reference") or "").strip() or f"ROW-{record['workbook_row']}"
    case_id = f"DSA-{slug(record.get('jurisdiction'), 'COUNTRY')}-{slug(record.get('court'), 'NO-COURT')}-{slug(reference, 'REFERENCE')}-{digest[:10].upper()}"
    return digest[:15], case_id[:80]


def payload_for(record, existing=None, candidate=False, workbook_hash=""):
    parties = record.get("parties") or {}
    payload = {
        "title": record["title"],
        "jurisdiction": record.get("jurisdiction", ""),
        "court": record.get("court", ""),
        "categories": list(record.get("categories") or []),
        "themes": list(record.get("themes") or []),
        "dsa_articles": list(record.get("dsa_articles") or []),
        "legal_basis": split_legal_basis(record.get("legal_basis")),
        "ecli": record.get("ecli", ""),
        "primary_sources": source_strings(record.get("primary_sources") or []),
        "secondary_sources": source_strings(record.get("secondary_sources") or []),
        "document_links": url_list((record.get("primary_sources") or []) + (record.get("secondary_sources") or [])),
        "plaintiffs": list(parties.get("plaintiffs") or []),
        "defendants": list(parties.get("defendants") or []),
        "keywords": [],
        "editorial_notes": append_note((existing or {}).get("editorial_notes"), record, candidate),
    }
    if existing is None:
        record_id, case_id = new_identifiers(record, workbook_hash)
        payload.update({"id": record_id, "case_id": case_id, "published": False, "status": "review"})
    return payload


def verify_plan_inputs(args):
    paths = {
        "workbook_sha256": existing_file(args.xlsx, "Workbook"),
        "cases_snapshot_sha256": existing_file(args.cases, "Cases snapshot"),
        "comments_snapshot_sha256": existing_file(args.comments, "Comments snapshot"),
        "matches_csv_sha256": existing_file(args.matches, "Match CSV"),
        "comment_audit_csv_sha256": existing_file(args.comment_audit, "Comment audit CSV"),
    }
    normalized = load_json(existing_file(args.normalized, "Normalized plan"), "normalized plan")
    plan = load_json(existing_file(args.plan, "Migration plan"), "migration plan")
    if normalized.get("format") != "dsa-normalized-workbook-review-v1" or plan.get("format") != "dsa-replacement-review-plan-v1":
        fail("Unexpected plan artifact format")
    for name in REQUIRED_FINGERPRINTS:
        actual = sha256(paths[name])
        if normalized.get("fingerprints", {}).get(name) != actual or plan.get("fingerprints", {}).get(name) != actual:
            fail(f"Input fingerprint mismatch for {name}")
    planner = load_planner()
    recalculated, hyperlink_count = planner.parse_workbook(paths["workbook_sha256"])
    if canonical(recalculated) != canonical(normalized.get("records")):
        fail("Normalized records do not match a fresh workbook normalization")
    proposals = plan.get("proposals")
    if not isinstance(proposals, list) or len(proposals) != len(recalculated):
        fail("Migration plan does not cover every normalized record")
    by_row = {item.get("workbook_row"): item for item in proposals}
    if len(by_row) != len(recalculated):
        fail("Migration plan has duplicate or malformed workbook rows")
    counts = {"reviewed_replacement_proposal": 0, "unresolved_candidate_replacement": 0, "separate_new_record_proposal": 0}
    for record in recalculated:
        proposal = by_row.get(record["workbook_row"])
        if not proposal or proposal.get("title") != record["title"]:
            fail(f"Migration plan mismatch at workbook row {record['workbook_row']}")
        action = proposal.get("action")
        if action not in counts:
            fail(f"Unapproved migration action: {action!r}")
        counts[action] += 1
    if counts != {"reviewed_replacement_proposal": 44, "unresolved_candidate_replacement": 7, "separate_new_record_proposal": 28}:
        fail(f"Plan does not match approved mapping policy: {counts}")
    source_cases = load_json(paths["cases_snapshot_sha256"], "cases snapshot")
    source_comments = load_json(paths["comments_snapshot_sha256"], "comments snapshot")
    if not isinstance(source_cases, list) or not isinstance(source_comments, list):
        fail("Source snapshots must be JSON lists")
    matches = planner.load_matches(paths["matches_csv_sha256"], {item["workbook_row"] for item in recalculated}, {item["id"] for item in source_cases})
    fingerprints = {name: sha256(path) for name, path in paths.items()}
    expected_plan = planner.build_plan(recalculated, matches, source_cases, source_comments, paths["comment_audit_csv_sha256"], fingerprints, hyperlink_count)
    for key in ("proposals", "retained_unmapped_histories", "retained_comments"):
        if canonical(plan.get(key)) != canonical(expected_plan.get(key)):
            fail(f"Migration plan {key} does not match the reviewed source inputs")
    return recalculated, proposals, source_cases, source_comments, paths


def build_operations(records, proposals, original_cases, workbook_hash):
    originals = {case["id"]: case for case in original_cases}
    if len(originals) != len(original_cases):
        fail("Cases snapshot has duplicate IDs")
    actions = {proposal["workbook_row"]: proposal for proposal in proposals}
    existing_case_ids = {str(case.get("case_id") or "") for case in original_cases}
    operations, reviewed_ids, generated_ids, generated_case_ids, references = [], set(), set(), set(), set()
    for record in records:
        proposal = actions[record["workbook_row"]]
        action = proposal["action"]
        reference = str(record.get("decision_reference") or "").strip()
        if reference and reference in references:
            fail(f"Duplicate decision reference in distinct workbook rows: {reference}")
        references.add(reference)
        if action == "reviewed_replacement_proposal":
            record_id = proposal.get("production_id")
            if record_id not in originals:
                fail(f"Reviewed production ID is absent from snapshot: {record_id}")
            reviewed_ids.add(record_id)
            body = payload_for(record, originals[record_id])
            operations.append({"method": "PATCH", "url": f"/api/collections/cases/records/{record_id}", "body": body})
        else:
            body = payload_for(record, None, action == "unresolved_candidate_replacement", workbook_hash)
            if body["id"] in originals or body["id"] in generated_ids or body["case_id"] in existing_case_ids or body["case_id"] in generated_case_ids:
                fail("Generated record identity conflicts with an existing or new case")
            generated_ids.add(body["id"])
            generated_case_ids.add(body["case_id"])
            operations.append({"method": "POST", "url": "/api/collections/cases/records", "body": body})
    archives = [case for case in original_cases if case["id"] not in reviewed_ids]
    if len(archives) != 18 or len(operations) != 79:
        fail("Approved policy must produce 44 updates, 35 creates, and 18 archives")
    for case in archives:
        operations.append({"method": "PATCH", "url": f"/api/collections/cases/records/{case['id']}", "body": {"published": False, "status": "archived"}})
    if len(operations) != 97 or any(item["method"] == "DELETE" for item in operations):
        fail("Unexpected operation count or destructive operation")
    return operations, reviewed_ids, {case["id"] for case in archives}


def make_rollback(original_cases, operations):
    rollback = []
    original_by_id = {case["id"]: case for case in original_cases}
    for operation in operations:
        if operation["method"] == "POST":
            rollback.append({"method": "PATCH", "url": f"/api/collections/cases/records/{operation['body']['id']}", "body": {"published": False, "status": "archived"}})
        else:
            record_id = operation["url"].rsplit("/", 1)[-1]
            before = original_by_id[record_id]
            body = {key: value for key, value in before.items() if key not in SYSTEM_FIELDS}
            rollback.append({"method": "PATCH", "url": operation["url"], "body": body})
    return {"notice": "Recovery artifact only. Do not apply automatically; it can overwrite concurrent edits.", "requests": rollback}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise RuntimeError(f"Refusing redirected PocketBase request to {newurl}")


class PocketBase:
    def __init__(self, target, email, password, timeout=120):
        self.target = target.rstrip("/")
        self.email, self.password, self.timeout, self.token = email, password, timeout, ""
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, path, body=None, timeout=None):
        data = None if body is None else canonical(body).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(self.target + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=timeout or self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:1000]
            raise RuntimeError(f"{method} {path} failed with HTTP {exc.code}: {detail}") from exc

    def authenticate(self):
        for path in ("/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"):
            try:
                response = self.request("POST", path, {"identity": self.email, "password": self.password}, timeout=30)
                self.token = response.get("token", "")
                if self.token:
                    return
            except RuntimeError:
                continue
        raise RuntimeError("PocketBase superuser authentication failed")

    def list_records(self, collection):
        records, page = [], 1
        while True:
            response = self.request("GET", f"/api/collections/{collection}/records?perPage=500&page={page}&sort=id")
            items = response.get("items", response if isinstance(response, list) else [])
            if not isinstance(items, list):
                raise RuntimeError(f"Unexpected {collection} list response")
            records.extend(items)
            if page >= int(response.get("totalPages", 1)):
                return records
            page += 1


def exact_snapshot(live, original):
    return canonical(sorted(live, key=lambda x: x["id"])) == canonical(sorted(original, key=lambda x: x["id"]))


def backup_key(response, name):
    return response.get("key") or response.get("name") or name


def verify_backup(client, key):
    backups = client.request("GET", "/api/backups")
    items = backups.get("items", backups) if isinstance(backups, dict) else backups
    for item in items:
        if item.get("key") == key or item.get("name") == key:
            if int(item.get("size") or 0) > 0:
                return item
            break
    raise RuntimeError("Server backup was not listed with a non-zero size")


def verify_post_apply(client, originals, comments, operations, reviewed_ids, archive_ids, original_batch):
    cases = client.list_records("cases")
    live_comments = client.list_records("case_comments")
    if len(cases) != 97 or not exact_snapshot(live_comments, comments):
        raise RuntimeError("Post-apply count or case_comments integrity verification failed")
    by_id = {case["id"]: case for case in cases}
    if len(by_id) != 97:
        raise RuntimeError("Post-apply duplicate case IDs")
    active = [case for case in cases if case["id"] not in archive_ids]
    published = sum(case.get("published") is True for case in active)
    unpublished = len(active) - published
    expected_published = sum(case.get("published") is True for case in originals if case["id"] in reviewed_ids)
    if len(active) != 79 or any(case.get("status") == "archived" for case in active) or published != expected_published or unpublished != 79 - expected_published:
        raise RuntimeError("New/reviewed case visibility verification failed")
    for record_id in archive_ids:
        before, after = next(case for case in originals if case["id"] == record_id), by_id[record_id]
        if after.get("published") is not False or after.get("status") != "archived":
            raise RuntimeError(f"Archived case has wrong visibility: {record_id}")
        for key, value in before.items():
            if key not in {"published", "status", "updated", "collectionId", "collectionName"} and after.get(key) != value:
                raise RuntimeError(f"Archived case changed a preserved field: {record_id}.{key}")
    for operation in operations:
        if operation["method"] == "PATCH" and operation["url"].rsplit("/", 1)[-1] in reviewed_ids:
            record_id = operation["url"].rsplit("/", 1)[-1]
            after = by_id[record_id]
            if any(after.get(key) != value for key, value in operation["body"].items()):
                raise RuntimeError("Reviewed replacement payload verification failed")
            before = next(case for case in originals if case["id"] == record_id)
            for key, value in before.items():
                if key not in set(operation["body"]) | {"updated"} and after.get(key) != value:
                    raise RuntimeError(f"Reviewed replacement changed a preserved field: {record_id}.{key}")
        elif operation["method"] == "POST":
            after = by_id.get(operation["body"]["id"])
            if not after or any(after.get(key) != value for key, value in operation["body"].items()):
                raise RuntimeError("New record payload verification failed")
    if client.request("GET", "/api/settings").get("batch") != original_batch:
        raise RuntimeError("PocketBase batch settings were not restored")
    return {"total_cases": len(cases), "active_cases": len(active), "archived_cases": len(archive_ids), "published_active_cases": published, "unpublished_active_cases": unpublished, "unchanged_comments": len(live_comments)}


def confirmed_batch_response(response, request_count):
    responses = response if isinstance(response, list) else response.get("responses") if isinstance(response, dict) else None
    if not isinstance(responses, list) or len(responses) != request_count:
        raise RuntimeError("Batch response did not contain one result for every request")
    if any(item.get("status") != 200 for item in responses if isinstance(item, dict)) or any(not isinstance(item, dict) for item in responses):
        raise RuntimeError("Batch response contains a non-200 request result")


def execute_apply(client, originals, comments, operations, reviewed_ids, archive_ids, receipt):
    live_cases, live_comments = client.list_records("cases"), client.list_records("case_comments")
    if not exact_snapshot(live_cases, originals) or not exact_snapshot(live_comments, comments):
        raise RuntimeError("Live data drifted from the approved snapshots; no backup or write was attempted")
    settings = client.request("GET", "/api/settings")
    original_batch = settings.get("batch")
    if not isinstance(original_batch, dict):
        raise RuntimeError("PocketBase settings has no usable batch configuration")
    backup_name = "dsa-replacement-" + datetime.now(UTC).strftime("%Y%m%dt%H%M%Sz") + ".zip"
    backup = client.request("POST", "/api/backups", {"name": backup_name}, timeout=120)
    verified_backup = verify_backup(client, backup_key(backup, backup_name))
    append_receipt(receipt, "backup_verified", backup=verified_backup)
    enabled_batch = {**original_batch, "enabled": True, "maxRequests": max(100, len(operations)), "timeout": max(15, int(original_batch.get("timeout") or 0)), "maxBodySize": max(5_000_000, int(original_batch.get("maxBodySize") or 0))}
    settings_changed = False
    batch_error = None
    try:
        settings_changed = True
        client.request("PATCH", "/api/settings", {"batch": enabled_batch})
        append_receipt(receipt, "batch_enabled", batch=enabled_batch)
        live_cases, live_comments = client.list_records("cases"), client.list_records("case_comments")
        if not exact_snapshot(live_cases, originals) or not exact_snapshot(live_comments, comments):
            raise RuntimeError("Live data drifted after backup/settings; batch was not attempted")
        append_receipt(receipt, "batch_started", request_count=len(operations))
        # Do not retry this call: timeout after commit is intentionally ambiguous.
        try:
            response = client.request("POST", "/api/batch", {"requests": operations}, timeout=120)
            confirmed_batch_response(response, len(operations))
            append_receipt(receipt, "batch_returned")
        except RuntimeError as exc:
            if "HTTP 400" in str(exc):
                append_receipt(receipt, "batch_rejected_rolled_back", error=str(exc))
                raise RuntimeError("PocketBase rejected the batch with HTTP 400; no retry was attempted") from exc
            batch_error = exc
            append_receipt(receipt, "batch_error_outcome_unknown", error=str(exc))
        except Exception as exc:
            batch_error = exc
            append_receipt(receipt, "batch_error_outcome_unknown", error=str(exc))
        if batch_error is None:
            current = client.request("GET", "/api/settings").get("batch")
            if current != enabled_batch:
                raise RuntimeError("Batch settings changed concurrently; refusing to overwrite them")
            client.request("PATCH", "/api/settings", {"batch": original_batch})
            settings_changed = False
            append_receipt(receipt, "batch_restored")
            counts = verify_post_apply(client, originals, comments, operations, reviewed_ids, archive_ids, original_batch)
            append_receipt(receipt, "verified", counts=counts)
    finally:
        if settings_changed:
            current = client.request("GET", "/api/settings").get("batch")
            if current == enabled_batch:
                client.request("PATCH", "/api/settings", {"batch": original_batch})
                append_receipt(receipt, "batch_restored_after_failure")
            elif current == original_batch:
                append_receipt(receipt, "batch_settings_unchanged_after_failure")
            else:
                append_receipt(receipt, "batch_restore_skipped_concurrent_change", current_batch=current)
    if batch_error is not None:
        try:
            counts = verify_post_apply(client, originals, comments, operations, reviewed_ids, archive_ids, original_batch)
        except Exception as reconciliation_error:
            append_receipt(receipt, "batch_outcome_still_unknown", reconciliation_error=str(reconciliation_error))
            raise RuntimeError(f"Batch request failed ({batch_error}) and post-error reconciliation could not prove its outcome; do not retry") from batch_error
        append_receipt(receipt, "verified_after_ambiguous_batch_error", counts=counts)


def validated_target(target, confirmation):
    if not target or target != confirmation:
        fail("--apply requires identical --target-url and --confirm-target values")
    parsed = urllib.parse.urlsplit(target)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        fail("Target must be a plain HTTPS URL without credentials, query, or fragment")
    if parsed.hostname.lower() in {"localhost", "127.0.0.1", "::1"}:
        fail("Localhost is not an allowed apply target")
    return target.rstrip("/")


def load_env(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def main():
    parser = argparse.ArgumentParser(description="Dry-run by default; safely apply the approved DSA replacement plan with one PocketBase batch.")
    parser.add_argument("--normalized", required=True)
    parser.add_argument("--plan", required=True)
    parser.add_argument("--xlsx", required=True)
    parser.add_argument("--cases", required=True)
    parser.add_argument("--comments", required=True)
    parser.add_argument("--matches", required=True)
    parser.add_argument("--comment-audit", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--target-url")
    parser.add_argument("--confirm-target")
    args = parser.parse_args()
    records, proposals, originals, comments, paths = verify_plan_inputs(args)
    operations, reviewed_ids, archive_ids = build_operations(records, proposals, originals, sha256(paths["workbook_sha256"]))
    output = private_output_dir(args.out_dir)
    write_private(output / "batch-requests.json", {"requests": operations})
    write_private(output / "rollback-requests.json", make_rollback(originals, operations))
    write_private(output / "summary.json", {"updates": 44, "creates": 35, "archives": 18, "operations": len(operations), "comments_written": 0, "dry_run": not args.apply})
    if not args.apply:
        print(f"Dry run prepared: 44 updates, 35 creates, 18 archives, 97 batch operations. {output}")
        return
    target = validated_target(args.target_url, args.confirm_target)
    load_env(REPO_ROOT / ".env")
    email, password = os.getenv("POCKETBASE_SUPERUSER_EMAIL"), os.getenv("POCKETBASE_SUPERUSER_PASSWORD")
    if not email or not password:
        fail("POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD are required for --apply")
    receipt = output / "apply-receipt.jsonl"
    write_private(receipt, {"event": "apply_started", "target": target, "operations": len(operations)})
    client = PocketBase(target, email, password)
    client.authenticate()
    execute_apply(client, originals, comments, operations, reviewed_ids, archive_ids, receipt)
    print(f"Apply verified: 44 updates, 35 creates, 18 archives, comments unchanged. {output}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Application failed: {exc}", file=sys.stderr)
        sys.exit(1)
