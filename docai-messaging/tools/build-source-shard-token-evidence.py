#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import re
import sys
from typing import Any


BUILDER_VERSION = "1.1.0"
EVIDENCE_NAME = "retrieval-runs.json"
RESULTS_NAME = "RESULTS.md"
EMISSION_DECISIONS = {
    "positive": "emit-source-shards",
    "negative": "retain-direct-sources",
}
TRACE_FIELDS = (
    "catalogForms",
    "consideredRootRows",
    "loadedSourceShards",
    "matchingSourceShards",
    "falsePositiveSourceShards",
    "transitiveSourceShards",
    "unloadedSourceShards",
    "fixedPoint",
    "requiredContextPaths",
    "consideredSupplementalContextPaths",
    "loadedSupplementalContextPaths",
    "loadAllSources",
    "loadAllFallback",
    "fullProfileFallback",
    "wholeConventionsFallback",
)
IDENTITY_PATTERN = re.compile(
    r"set_id: (?P<set_id>b32:[a-z2-7]{26})"
    r" \| projection_id: (?P<projection_id>b32:[a-z2-7]{26})"
    r" \| set_digest: (?P<set_digest>sha256:[0-9a-f]{64})"
    r" \| projection_digest: (?P<projection_digest>sha256:[0-9a-f]{64})"
)


class EvidenceError(ValueError):
    pass


def sha256_bytes(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def derive_short_id(digest: str) -> str:
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise EvidenceError("projection digest has an invalid sha256 form")
    prefix = bytes.fromhex(digest.removeprefix("sha256:")[:32])
    encoded = base64.b32encode(prefix).decode("ascii").lower().rstrip("=")
    return f"b32:{encoded}"


def read_utf8(path: Path) -> tuple[bytes, str]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise EvidenceError(f"cannot read {path}: {error.strerror}") from error
    try:
        return raw, raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise EvidenceError(f"{path} is not valid UTF-8") from error


def read_json(path: Path) -> tuple[bytes, dict[str, Any]]:
    raw, text = read_utf8(path)
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise EvidenceError(f"{path} is not valid JSON: {error.msg}") from error
    if not isinstance(value, dict):
        raise EvidenceError(f"{path} must contain a JSON object")
    return raw, value


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def resolve_inside(root: Path, relative: str, label: str) -> Path:
    if not isinstance(relative, str) or relative == "":
        raise EvidenceError(f"{label} must be a non-empty relative path")
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise EvidenceError(f"{label} escapes the evidence root: {relative}") from error
    return candidate


def validate_input(input_path: Path, value: dict[str, Any]) -> None:
    expected_tokenizer = {
        "library": "tiktoken",
        "version": "0.13.0",
        "encoding": "o200k_base",
    }
    if value.get("schemaVersion") != "1.1.0":
        raise EvidenceError("schemaVersion must be 1.1.0")
    if value.get("docaiMessaging") != "0.17.1":
        raise EvidenceError("docaiMessaging must be 0.17.1")
    if value.get("tokenizer") != expected_tokenizer:
        raise EvidenceError("tokenizer must be tiktoken 0.13.0 with o200k_base")
    if value.get("targetModel") is not None:
        raise EvidenceError("targetModel must be null when the encoding is selected directly")
    if not isinstance(value.get("tokenBudget"), int) or value["tokenBudget"] <= 0:
        raise EvidenceError("tokenBudget must be a positive integer")
    if not isinstance(value.get("sharedContext"), dict):
        raise EvidenceError("sharedContext must be an object")
    tasks = value.get("tasks")
    if not isinstance(tasks, list) or len(tasks) == 0:
        raise EvidenceError("tasks must contain at least one task")
    task_ids: set[str] = set()
    task_control_kinds: dict[str, str] = {}
    for task in tasks:
        if not isinstance(task, dict) or not isinstance(task.get("id"), str):
            raise EvidenceError("every task must have a string id")
        if task["id"] in task_ids:
            raise EvidenceError(f"duplicate task id: {task['id']}")
        task_ids.add(task["id"])
        control = task.get("control")
        if not isinstance(control, dict) or set(control) != {
            "kind", "expectedEmissionDecision"
        }:
            raise EvidenceError(f"task {task['id']} control metadata is invalid")
        control_kind = control.get("kind")
        if control_kind not in EMISSION_DECISIONS \
                or control.get("expectedEmissionDecision") != EMISSION_DECISIONS[control_kind]:
            raise EvidenceError(f"task {task['id']} control expectation is invalid")
        if control_kind in task_control_kinds:
            raise EvidenceError(f"duplicate {control_kind} control task")
        task_control_kinds[control_kind] = task["id"]
        if not isinstance(task.get("selectionInput"), dict):
            raise EvidenceError(f"task {task['id']} selectionInput must be an object")
        contributions = task.get("catalogCellContributions")
        if not isinstance(contributions, list) or len(contributions) == 0:
            raise EvidenceError(
                f"task {task['id']} catalogCellContributions must be a non-empty list"
            )
        runs = task.get("runs")
        if not isinstance(runs, dict) or set(runs) != {"sharded", "direct"}:
            raise EvidenceError(f"task {task['id']} must define sharded and direct runs")
        for run_name, run in runs.items():
            if not isinstance(run, dict):
                raise EvidenceError(f"task {task['id']} run {run_name} must be an object")
            if not isinstance(run.get("formatSpecificInstructions"), str):
                raise EvidenceError(f"task {task['id']} run {run_name} needs instructions")
            loaded_paths = run.get("loadedDocumentPaths")
            if not isinstance(loaded_paths, list) or len(loaded_paths) == 0:
                raise EvidenceError(f"task {task['id']} run {run_name} needs loaded documents")
            if any(not isinstance(path, str) or path == "" for path in loaded_paths):
                raise EvidenceError(f"task {task['id']} run {run_name} has an invalid document path")
            if len(set(loaded_paths)) != len(loaded_paths):
                raise EvidenceError(f"task {task['id']} run {run_name} repeats a document path")
            for field in TRACE_FIELDS:
                if field not in run:
                    raise EvidenceError(f"task {task['id']} run {run_name} omits {field}")

    if set(task_control_kinds) != set(EMISSION_DECISIONS):
        raise EvidenceError("tasks must contain exactly one positive and one negative control")
    claim = value.get("claim")
    if not isinstance(claim, dict) or set(claim) != {
        "scope", "taskIds", "cacheOrBilledTokenSavings"
    } or not isinstance(claim.get("scope"), str) or claim["scope"] == "" \
            or claim.get("cacheOrBilledTokenSavings") is not False:
        raise EvidenceError("claim metadata is invalid")
    claim_task_ids = claim.get("taskIds")
    positive_task_ids = [
        task["id"] for task in tasks if task["control"]["kind"] == "positive"
    ]
    if not isinstance(claim_task_ids, list) \
            or claim_task_ids != positive_task_ids:
        raise EvidenceError("claim taskIds must name every positive control in task order")

    requirements_path = input_path.parent / "requirements.txt"
    _, requirements = read_utf8(requirements_path)
    if requirements != "tiktoken==0.13.0\n":
        raise EvidenceError("requirements.txt must contain only tiktoken==0.13.0")


def projection_catalog(
    source_input: dict[str, Any],
    configuration: dict[str, Any],
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    expected_derivation = {
        "rowOrder": "source-id-ascii-ascending",
        "baseValuePrecedence": "authoritative-contribution-then-source-self-description",
        "multipleAuthoritativeContributors": "generation-failure",
        "missingRequiredCell": "generation-failure",
    }
    if source_input.get("schemaVersion") != "1.0.0" \
            or source_input.get("classification") != "synthetic-conformance":
        raise EvidenceError("authoritative source catalog metadata is invalid")
    if configuration.get("schemaVersion") != "1.0.0" \
            or configuration.get("classification") != "synthetic-conformance" \
            or configuration.get("catalogDerivation") != expected_derivation:
        raise EvidenceError("projection configuration metadata is invalid")

    sources = source_input.get("sources")
    if not isinstance(sources, list) or len(sources) == 0:
        raise EvidenceError("authoritative source catalog must contain sources")
    source_ids: set[str] = set()
    bases: dict[str, dict[str, str]] = {}
    contributions: list[dict[str, str]] = []
    for source in sources:
        if not isinstance(source, dict):
            raise EvidenceError("authoritative source entries must be objects")
        source_id = source.get("id")
        kind = source.get("kind")
        catalog = source.get("catalog")
        if not isinstance(source_id, str) or source_id == "" or source_id in source_ids:
            raise EvidenceError("authoritative source IDs must be unique non-empty strings")
        if not isinstance(kind, str) or kind == "" or not isinstance(catalog, dict):
            raise EvidenceError(f"authoritative source {source_id} has invalid catalog data")
        source_ids.add(source_id)
        bases[source_id] = {"id": source_id, "kind": kind, **catalog}
        source_contributions = source.get("catalogCellContributions", [])
        if not isinstance(source_contributions, list):
            raise EvidenceError(f"authoritative source {source_id} contributions must be a list")
        for contribution in source_contributions:
            if not isinstance(contribution, dict) \
                    or contribution.get("providerSourceId") != source_id:
                raise EvidenceError(f"authoritative source {source_id} has an invalid contribution")
            contributions.append(contribution)

    required_columns = (
        "id", "kind", "specification", "api", "contractVersion", "location", "revision"
    )
    contribution_columns = {
        "Specification": "specification",
        "API": "api",
        "Contract version": "contractVersion",
        "Location": "location",
        "Revision": "revision",
    }
    contribution_keys: set[tuple[str, str]] = set()
    for contribution in contributions:
        target_id = contribution.get("targetSourceId")
        column = contribution.get("column")
        value = contribution.get("value")
        key = (target_id, column)
        if target_id not in bases or column not in contribution_columns \
                or not isinstance(value, str) or value == "" or key in contribution_keys:
            raise EvidenceError("authoritative catalog-cell contribution is invalid or ambiguous")
        contribution_keys.add(key)
        bases[target_id][contribution_columns[column]] = value

    rows = []
    for source_id in sorted(source_ids):
        row = bases[source_id]
        if set(row) != set(required_columns) \
                or any(not isinstance(row[column], str) or row[column] == "" for column in required_columns):
            raise EvidenceError(f"authoritative source {source_id} does not resolve every catalog cell")
        rows.append({column: row[column] for column in required_columns})
    return rows, contributions


def load_projection(input_path: Path, value: dict[str, Any]) -> dict[str, Any]:
    manifest_path = resolve_inside(
        input_path.parent,
        value.get("projectionManifest"),
        "projectionManifest",
    )
    manifest_bytes, manifest = read_json(manifest_path)
    if manifest.get("manifestVersion") != "1.0.0" \
            or manifest.get("docaiMessaging") != value.get("docaiMessaging") \
            or manifest.get("classification") != "synthetic-conformance":
        raise EvidenceError("projection manifest metadata is invalid")
    input_entries = manifest.get("projectionInputs")
    if not isinstance(input_entries, list) or len(input_entries) != 2:
        raise EvidenceError("projection manifest must declare two projectionInputs")
    loaded_inputs: dict[str, dict[str, Any]] = {}
    recorded_inputs = []
    for entry in input_entries:
        if not isinstance(entry, dict):
            raise EvidenceError("projectionInputs entries must be objects")
        role = entry.get("role")
        if role in loaded_inputs or role not in {
            "authoritative-source-catalog", "projection-configuration"
        }:
            raise EvidenceError("projection input roles must be unique and recognized")
        source_path = resolve_inside(input_path.parent, entry.get("path"), "projection input")
        raw, source_value = read_json(source_path)
        expected = {
            "role": role,
            "path": source_path.relative_to(input_path.parent).as_posix(),
            "bytes": len(raw),
            "sha256": sha256_bytes(raw),
        }
        if entry != expected:
            raise EvidenceError(f"projection input digest is stale: {expected['path']}")
        loaded_inputs[role] = source_value
        recorded_inputs.append(expected)
    catalog, contributions = projection_catalog(
        loaded_inputs["authoritative-source-catalog"],
        loaded_inputs["projection-configuration"],
    )
    if manifest.get("catalog") != catalog:
        raise EvidenceError("projection manifest catalog disagrees with authoritative inputs")
    return {
        "manifestPath": manifest_path.relative_to(input_path.parent).as_posix(),
        "manifestDigest": sha256_bytes(manifest_bytes),
        "classification": manifest["classification"],
        "inputs": recorded_inputs,
        "catalogCellContributions": contributions,
    }


def root_identity(document_set: Path) -> dict[str, str]:
    _, root_text = read_utf8(document_set / "INDEX.md")
    matches = list(IDENTITY_PATTERN.finditer(root_text))
    if len(matches) != 1:
        raise EvidenceError(f"{document_set}/INDEX.md must contain one root identity")
    return {
        "setId": matches[0].group("set_id"),
        "setDigest": matches[0].group("set_digest"),
        "projectionId": matches[0].group("projection_id"),
        "projectionDigest": matches[0].group("projection_digest"),
    }


def validate_projection_identities(
    projection: dict[str, Any],
    identities: list[dict[str, str]],
) -> str:
    expected_digest = projection["manifestDigest"]
    expected_id = derive_short_id(expected_digest)
    if len(identities) == 0 or any(
        identity.get("projectionDigest") != expected_digest
        or identity.get("projectionId") != expected_id
        for identity in identities
    ):
        raise EvidenceError("document projection identity disagrees with projection manifest")
    return expected_id


def tool_result_context(task: dict[str, Any], run_name: str, run: dict[str, Any]) -> dict[str, Any]:
    return {
        "selectionInput": task["selectionInput"],
        "catalogCellContributions": task["catalogCellContributions"],
        "representation": run_name,
        **{field: run[field] for field in TRACE_FIELDS},
    }


def frame(label: str, payload: bytes) -> bytes:
    header = f"@@BEGIN {label} bytes={len(payload)}@@\n".encode("utf-8")
    footer = f"\n@@END {label}@@\n".encode("utf-8")
    return header + payload + footer


def document_payload(document_set: Path, paths: list[str]) -> tuple[bytes, list[dict[str, Any]]]:
    chunks: list[bytes] = []
    documents: list[dict[str, Any]] = []
    for relative in paths:
        file_path = resolve_inside(document_set, relative, "loadedDocumentPaths entry")
        raw, _ = read_utf8(file_path)
        digest = sha256_bytes(raw)
        header = f"DOCUMENT path={relative} bytes={len(raw)} digest={digest}\n".encode("utf-8")
        chunks.append(header + raw + b"\nEND DOCUMENT\n")
        documents.append({
            "path": relative,
            "bytes": len(raw),
            "sha256": digest,
        })
    return b"".join(chunks), documents


def tokenizer_for(value: dict[str, str]):
    try:
        import tiktoken
    except ModuleNotFoundError as error:
        raise EvidenceError(
            "tiktoken is not installed; install the artifact-local requirements.txt"
        ) from error
    installed = importlib.metadata.version(value["library"])
    if installed != value["version"]:
        raise EvidenceError(
            f"tiktoken version mismatch: expected {value['version']}, found {installed}"
        )
    encoding = tiktoken.get_encoding(value["encoding"])
    if encoding.name != value["encoding"]:
        raise EvidenceError(f"tokenizer encoding mismatch: {encoding.name}")
    return encoding


def token_count(encoding, value: bytes) -> int:
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError as error:
        raise EvidenceError("measurement component is not valid UTF-8") from error
    return len(encoding.encode(text, disallowed_special=()))


def assemble_run(
    evidence_root: Path,
    shared_context: dict[str, Any],
    task: dict[str, Any],
    run_name: str,
    run: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, bytes], bytes]:
    document_set = resolve_inside(evidence_root, run["documentSet"], "documentSet")
    if not document_set.is_dir():
        raise EvidenceError(f"documentSet is not a directory: {run['documentSet']}")
    identity = root_identity(document_set)
    shared_payload = canonical_json(shared_context).encode("utf-8")
    instructions_payload = run["formatSpecificInstructions"].encode("utf-8")
    tool_payload = canonical_json(tool_result_context(task, run_name, run)).encode("utf-8")
    documents_payload, loaded_documents = document_payload(
        document_set,
        run["loadedDocumentPaths"],
    )
    component_payloads = {
        "shared-task-context": shared_payload,
        "format-specific-instructions": instructions_payload,
        "retrieval-tool-result-context": tool_payload,
        "loaded-document-context": documents_payload,
    }
    framed = {name: frame(name, payload) for name, payload in component_payloads.items()}
    envelope = b"".join(framed.values())
    run_record = {
        "documentSet": run["documentSet"],
        "baseline": run["baseline"],
        "identity": identity,
        **{field: run[field] for field in TRACE_FIELDS},
        "loadedDocuments": loaded_documents,
    }
    return run_record, framed, envelope


def measure_run(
    evidence_root: Path,
    shared_context: dict[str, Any],
    task: dict[str, Any],
    run_name: str,
    run: dict[str, Any],
    encoding,
) -> dict[str, Any]:
    run_record, framed, envelope = assemble_run(
        evidence_root,
        shared_context,
        task,
        run_name,
        run,
    )
    document_set = resolve_inside(evidence_root, run["documentSet"], "documentSet")
    for document in run_record["loadedDocuments"]:
        raw, _ = read_utf8(resolve_inside(document_set, document["path"], "loaded document"))
        document["tokens"] = token_count(encoding, raw)
    component_tokens = {name: token_count(encoding, value) for name, value in framed.items()}
    total_tokens = token_count(encoding, envelope)
    return {
        **run_record,
        "measurement": {
            "envelopeBytes": len(envelope),
            "envelopeSha256": sha256_bytes(envelope),
            "sharedContextTokens": component_tokens["shared-task-context"],
            "formatSpecificInstructionTokens": component_tokens["format-specific-instructions"],
            "toolResultContextTokens": component_tokens["retrieval-tool-result-context"],
            "documentTokens": component_tokens["loaded-document-context"],
            "componentTokenSum": sum(component_tokens.values()),
            "boundaryTokenDelta": total_tokens - sum(component_tokens.values()),
        },
        "totalTaskInputTokens": total_tokens,
    }


def nearest_rank(values: list[int], percentile: float) -> int:
    ordered = sorted(values)
    return ordered[math.ceil(percentile * len(ordered)) - 1]


def aggregate(tasks: list[dict[str, Any]], run_name: str) -> dict[str, int]:
    totals = [task["runs"][run_name]["totalTaskInputTokens"] for task in tasks]
    return {
        "p50": nearest_rank(totals, 0.50),
        "p95": nearest_rank(totals, 0.95),
        "maximum": max(totals),
    }


def emission_decision(runs: dict[str, dict[str, Any]]) -> str:
    if runs["sharded"]["totalTaskInputTokens"] < runs["direct"]["totalTaskInputTokens"]:
        return "emit-source-shards"
    return "retain-direct-sources"


def build_claim(
    input_claim: dict[str, Any],
    tasks: list[dict[str, Any]],
    aggregates: dict[str, dict[str, int]],
) -> dict[str, Any]:
    tasks_by_id = {task["id"]: task for task in tasks}
    claim_tasks = [tasks_by_id[task_id] for task_id in input_claim["taskIds"]]
    claim_aggregates = {
        run_name: aggregate(claim_tasks, run_name)
        for run_name in ("sharded", "direct")
    }
    sharded_total = claim_aggregates["sharded"]["maximum"]
    direct_total = claim_aggregates["direct"]["maximum"]
    saved = direct_total - sharded_total
    task_regressions = []
    for task in tasks:
        sharded = task["runs"]["sharded"]["totalTaskInputTokens"]
        direct = task["runs"]["direct"]["totalTaskInputTokens"]
        if sharded >= direct:
            task_regressions.append({
                "taskId": task["id"],
                "shardedTotalTaskInputTokens": sharded,
                "directTotalTaskInputTokens": direct,
                "tokenDelta": sharded - direct,
            })
    aggregate_regressions = []
    for statistic in ("p50", "p95", "maximum"):
        sharded = aggregates["sharded"][statistic]
        direct = aggregates["direct"][statistic]
        if sharded >= direct:
            aggregate_regressions.append({
                "statistic": statistic,
                "shardedTotalTaskInputTokens": sharded,
                "directTotalTaskInputTokens": direct,
                "tokenDelta": sharded - direct,
            })
    scoped_lower = all(
        claim_aggregates["sharded"][key] < claim_aggregates["direct"][key]
        for key in ("p50", "p95", "maximum")
    )
    return {
        **input_claim,
        "shardedLowerThanDirect": scoped_lower,
        "absoluteTokensSavedAtMaximum": saved,
        "relativeSavingsPercentAtMaximum": round(saved * 100 / direct_total, 3),
        "unqualifiedSavingsSupported": not task_regressions and not aggregate_regressions,
        "disclosedTaskRegressions": task_regressions,
        "disclosedAggregateRegressions": aggregate_regressions,
    }


def build_evidence(input_path: Path, raw_input: bytes, value: dict[str, Any]) -> dict[str, Any]:
    validate_input(input_path, value)
    encoding = tokenizer_for(value["tokenizer"])
    projection = load_projection(input_path, value)
    measured_tasks = []
    projection_identities = []
    for task in value["tasks"]:
        if task["catalogCellContributions"] != projection["catalogCellContributions"]:
            raise EvidenceError(
                f"task {task['id']} contributions disagree with authoritative inputs"
            )
        runs = {
            run_name: measure_run(
                input_path.parent,
                value["sharedContext"],
                task,
                run_name,
                task["runs"][run_name],
                encoding,
            )
            for run_name in ("sharded", "direct")
        }
        observed_decision = emission_decision(runs)
        expected_decision = task["control"]["expectedEmissionDecision"]
        if observed_decision != expected_decision:
            raise EvidenceError(
                f"task {task['id']} expected {expected_decision} but observed {observed_decision}"
            )
        projection_identities.extend(run["identity"] for run in runs.values())
        measured_tasks.append({
            "id": task["id"],
            "control": {
                **task["control"],
                "observedEmissionDecision": observed_decision,
            },
            "selectionInput": task["selectionInput"],
            "catalogCellContributions": task["catalogCellContributions"],
            "runs": runs,
        })
    projection_id = validate_projection_identities(projection, projection_identities)

    aggregates = {
        run_name: aggregate(measured_tasks, run_name)
        for run_name in ("sharded", "direct")
    }
    claim = build_claim(value["claim"], measured_tasks, aggregates)
    return {
        "schemaVersion": value["schemaVersion"],
        "generatedBy": {
            "tool": "build-source-shard-token-evidence.py",
            "version": BUILDER_VERSION,
        },
        "measurementInput": {
            "path": input_path.name,
            "sha256": sha256_bytes(raw_input),
        },
        "docaiMessaging": value["docaiMessaging"],
        "projection": {
            **projection,
            "projectionId": projection_id,
        },
        "evaluatedProfiles": value["evaluatedProfiles"],
        "tokenizer": value["tokenizer"],
        "targetModel": value["targetModel"],
        "tokenBudget": value["tokenBudget"],
        "retrievalUnitPolicy": value["retrievalUnitPolicy"],
        "normalizationBoundary": value["normalizationBoundary"],
        "readerAccountingBoundary": value["readerAccountingBoundary"],
        "tasks": measured_tasks,
        "aggregates": aggregates,
        "claim": claim,
    }


def render_json(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def render_markdown(value: dict[str, Any]) -> bytes:
    tokenizer = value["tokenizer"]
    claim = value["claim"]
    lines = [
        "# Source Shard Token Evidence",
        "",
        f"- DocAI Messaging: `{value['docaiMessaging']}`",
        f"- Projection ID: `{value['projection']['projectionId']}`",
        f"- Projection digest: `{value['projection']['manifestDigest']}`",
        f"- Evidence classification: `{value['projection']['classification']}`",
        f"- Tokenizer: `{tokenizer['library']}=={tokenizer['version']}` / `{tokenizer['encoding']}`",
        f"- Evaluated profiles: `{', '.join(value['evaluatedProfiles'])}`",
        f"- Token budget: `{value['tokenBudget']}`",
        f"- Claim scope: `{claim['scope']}`",
        f"- Claim task IDs: `{', '.join(claim['taskIds'])}`",
        "- Cache or billed-token savings claim: `no`",
        "",
        "## Per-task totals",
        "",
        "| Task | Control | Emission decision | Sharded | Direct | Difference |",
        "|---|---|---|---:|---:|---:|",
    ]
    for task in value["tasks"]:
        sharded = task["runs"]["sharded"]["totalTaskInputTokens"]
        direct = task["runs"]["direct"]["totalTaskInputTokens"]
        lines.append(
            f"| `{task['id']}` | {task['control']['kind']} | "
            f"`{task['control']['observedEmissionDecision']}` | "
            f"{sharded} | {direct} | {sharded - direct} |"
        )
    lines.extend([
        "",
        "## Nearest-rank aggregates",
        "",
        "| Representation | p50 | p95 | Maximum |",
        "|---|---:|---:|---:|",
    ])
    for run_name in ("sharded", "direct"):
        result = value["aggregates"][run_name]
        lines.append(
            f"| {run_name} | {result['p50']} | {result['p95']} | {result['maximum']} |"
        )
    lines.extend([
        "",
        "## Source-shard trace",
        "",
    ])
    for task in value["tasks"]:
        run = task["runs"]["sharded"]
        lines.extend([
            f"### `{task['id']}`",
            "",
            f"- Considered root rows: `{', '.join(run['consideredRootRows'])}`",
            f"- Loaded source shards: `{', '.join(run['loadedSourceShards'])}`",
            f"- False-positive shards: `{', '.join(run['falsePositiveSourceShards'])}`",
            f"- Transitive shards: `{', '.join(run['transitiveSourceShards'])}`",
            f"- Unloaded shards: `{', '.join(run['unloadedSourceShards'])}`",
            f"- Fixed point resolved IDs: `{', '.join(run['fixedPoint']['resolvedIds'])}`",
            f"- Load all sources: `{'yes' if run['loadAllSources'] else 'no'}`",
            f"- Load-all fallback: `{'yes' if run['loadAllFallback'] else 'no'}`",
            f"- Full-profile fallback: `{'yes' if run['fullProfileFallback'] else 'no'}`",
            "- Whole-CONVENTIONS fallback: "
            f"`{'yes' if run['wholeConventionsFallback'] else 'no'}`",
            "",
        ])
    outcome = "supported" if claim["shardedLowerThanDirect"] else "not supported"
    unqualified = "yes" if claim["unqualifiedSavingsSupported"] else "no"
    lines.extend([
        "## Claim boundary",
        "",
        f"The scoped Source Shards emission claim is **{outcome}**: maximum savings are "
        f"{claim['absoluteTokensSavedAtMaximum']} tokens "
        f"({claim['relativeSavingsPercentAtMaximum']:.3f}%).",
        f"- Unqualified savings supported across all controls: `{unqualified}`",
        "- Disclosed task regressions: " + (
            ", ".join(
                f"`{item['taskId']}` ({item['tokenDelta']:+d} tokens)"
                for item in claim["disclosedTaskRegressions"]
            ) or "`none`"
        ),
        "- Disclosed aggregate regressions: " + (
            ", ".join(
                f"`{item['statistic']}` ({item['tokenDelta']:+d} tokens)"
                for item in claim["disclosedAggregateRegressions"]
            ) or "`none`"
        ),
        "This is not an unqualified DocAI, cache, billed-token, compact-profile, or complete-surface savings claim.",
        "",
        "The measurement counts the canonical UTF-8 envelope described in `measurement-input.json`. "
        "Component token counts are diagnostic; `boundaryTokenDelta` records tokenizer merges across "
        "component boundaries, and `totalTaskInputTokens` is measured from the complete envelope.",
        "",
    ])
    return "\n".join(lines).encode("utf-8")


def validate_recorded(input_path: Path, raw_input: bytes, value: dict[str, Any]) -> None:
    validate_input(input_path, value)
    evidence_path = input_path.parent / EVIDENCE_NAME
    _, evidence = read_json(evidence_path)
    expected_top_level_fields = {
        "schemaVersion",
        "generatedBy",
        "measurementInput",
        "docaiMessaging",
        "projection",
        "evaluatedProfiles",
        "tokenizer",
        "targetModel",
        "tokenBudget",
        "retrievalUnitPolicy",
        "normalizationBoundary",
        "readerAccountingBoundary",
        "tasks",
        "aggregates",
        "claim",
    }
    if set(evidence) != expected_top_level_fields:
        raise EvidenceError("recorded evidence metadata is stale")
    if evidence.get("schemaVersion") != value["schemaVersion"]:
        raise EvidenceError("recorded schemaVersion disagrees with measurement input")
    if evidence.get("tokenizer") != value["tokenizer"]:
        raise EvidenceError("recorded tokenizer disagrees with measurement input")
    expected_metadata = {
        "generatedBy": {
            "tool": "build-source-shard-token-evidence.py",
            "version": BUILDER_VERSION,
        },
        "docaiMessaging": value["docaiMessaging"],
        "evaluatedProfiles": value["evaluatedProfiles"],
        "targetModel": value["targetModel"],
        "tokenBudget": value["tokenBudget"],
        "retrievalUnitPolicy": value["retrievalUnitPolicy"],
        "normalizationBoundary": value["normalizationBoundary"],
        "readerAccountingBoundary": value["readerAccountingBoundary"],
    }
    if any(evidence.get(key) != expected for key, expected in expected_metadata.items()):
        raise EvidenceError("recorded evidence metadata is stale")
    if evidence.get("measurementInput") != {
        "path": input_path.name,
        "sha256": sha256_bytes(raw_input),
    }:
        raise EvidenceError("recorded measurement input digest is stale")
    projection = load_projection(input_path, value)
    recorded_projection = evidence.get("projection", {})
    expected_projection = {**projection, "projectionId": derive_short_id(projection["manifestDigest"])}
    if recorded_projection != expected_projection:
        raise EvidenceError("recorded projection manifest is stale")

    recorded_tasks = evidence.get("tasks")
    if not isinstance(recorded_tasks, list) or len(recorded_tasks) != len(value["tasks"]):
        raise EvidenceError("recorded tasks disagree with measurement input")
    projection_identities = []
    for task, recorded_task in zip(value["tasks"], recorded_tasks):
        if task["catalogCellContributions"] != projection["catalogCellContributions"]:
            raise EvidenceError(
                f"task {task['id']} contributions disagree with authoritative inputs"
            )
        recorded_runs = recorded_task.get("runs") if isinstance(recorded_task, dict) else None
        if not isinstance(recorded_task, dict) \
                or set(recorded_task) != {
                    "id", "control", "selectionInput", "catalogCellContributions", "runs"
                } \
                or not isinstance(recorded_runs, dict) \
                or set(recorded_runs) != {"sharded", "direct"} \
                or recorded_task.get("id") != task["id"] \
                or recorded_task.get("selectionInput") != task["selectionInput"] \
                or recorded_task.get("catalogCellContributions") \
                != task["catalogCellContributions"]:
            raise EvidenceError(f"recorded task identity is stale: {task['id']}")
        for run_name in ("sharded", "direct"):
            run = task["runs"][run_name]
            recorded_run = recorded_runs[run_name]
            expected_run, _, envelope = assemble_run(
                input_path.parent,
                value["sharedContext"],
                task,
                run_name,
                run,
            )
            if not isinstance(recorded_run, dict) \
                    or set(recorded_run) != {*expected_run, "measurement", "totalTaskInputTokens"}:
                raise EvidenceError(f"recorded run metadata is stale: {task['id']} {run_name}")
            if recorded_run.get("documentSet") != expected_run["documentSet"] \
                    or recorded_run.get("baseline") != expected_run["baseline"]:
                raise EvidenceError(f"recorded run identity is stale: {task['id']} {run_name}")
            document_identity = expected_run["identity"]
            if recorded_run.get("identity") != document_identity:
                raise EvidenceError(
                    f"recorded document-set identity is stale: {task['id']} {run_name}"
                )
            validate_projection_identities(projection, [document_identity])
            projection_identities.append(document_identity)
            for field in TRACE_FIELDS:
                if recorded_run.get(field) != run[field]:
                    raise EvidenceError(f"recorded {field} is stale: {task['id']} {run_name}")
            expected_documents = expected_run["loadedDocuments"]
            recorded_documents = recorded_run.get("loadedDocuments")
            if not isinstance(recorded_documents, list) \
                    or len(recorded_documents) != len(expected_documents):
                raise EvidenceError(f"recorded loaded documents are stale: {task['id']} {run_name}")
            for expected, recorded in zip(expected_documents, recorded_documents):
                if not isinstance(recorded, dict) \
                        or set(recorded) != {*expected, "tokens"} \
                        or any(recorded.get(key) != expected[key] for key in expected):
                    raise EvidenceError(f"recorded document digest is stale: {expected['path']}")
                if type(recorded["tokens"]) is not int or recorded["tokens"] < 0:
                    raise EvidenceError(
                        f"recorded document token metadata is invalid: {expected['path']}"
                    )

            measurement = recorded_run.get("measurement")
            measurement_fields = {
                "envelopeBytes",
                "envelopeSha256",
                "sharedContextTokens",
                "formatSpecificInstructionTokens",
                "toolResultContextTokens",
                "documentTokens",
                "componentTokenSum",
                "boundaryTokenDelta",
            }
            if not isinstance(measurement, dict) or set(measurement) != measurement_fields \
                    or measurement.get("envelopeBytes") != len(envelope) \
                    or measurement.get("envelopeSha256") != sha256_bytes(envelope):
                raise EvidenceError(
                    f"recorded canonical envelope is stale: {task['id']} {run_name}"
                )
            component_fields = (
                "sharedContextTokens",
                "formatSpecificInstructionTokens",
                "toolResultContextTokens",
                "documentTokens",
            )
            if any(
                type(measurement.get(field)) is not int or measurement[field] < 0
                for field in component_fields
            ) or type(measurement.get("componentTokenSum")) is not int \
                    or measurement["componentTokenSum"] != sum(
                        measurement[field] for field in component_fields
                    ):
                raise EvidenceError(
                    f"recorded component token arithmetic is invalid: {task['id']} {run_name}"
                )
            total_tokens = recorded_run.get("totalTaskInputTokens")
            boundary_delta = measurement.get("boundaryTokenDelta")
            if type(total_tokens) is not int or total_tokens <= 0 \
                    or type(boundary_delta) is not int \
                    or total_tokens != measurement["componentTokenSum"] + boundary_delta:
                raise EvidenceError(
                    f"recorded total token arithmetic is invalid: {task['id']} {run_name}"
                )
        expected_control = {
            **task["control"],
            "observedEmissionDecision": emission_decision(recorded_runs),
        }
        if recorded_task.get("control") != expected_control \
                or expected_control["observedEmissionDecision"] \
                != expected_control["expectedEmissionDecision"]:
            raise EvidenceError(f"recorded control outcome is stale: {task['id']}")

    validate_projection_identities(projection, projection_identities)

    expected_aggregates = {
        run_name: aggregate(recorded_tasks, run_name)
        for run_name in ("sharded", "direct")
    }
    if evidence.get("aggregates") != expected_aggregates:
        raise EvidenceError("recorded aggregates are stale")
    if evidence.get("claim") != build_claim(
        value["claim"], recorded_tasks, expected_aggregates
    ):
        raise EvidenceError("recorded claim arithmetic is stale")
    _, recorded_markdown = read_utf8(input_path.parent / RESULTS_NAME)
    if recorded_markdown.encode("utf-8") != render_markdown(evidence):
        raise EvidenceError("RESULTS.md is stale")


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build deterministic Core source-shard token evidence."
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="compare regenerated output")
    mode.add_argument(
        "--validate",
        action="store_true",
        help="validate committed inputs and digests without importing tiktoken",
    )
    parser.add_argument("input", type=Path)
    return parser.parse_args(arguments)


def run(arguments: list[str]) -> int:
    options = parse_arguments(arguments)
    input_path = options.input.resolve()
    raw_input, value = read_json(input_path)
    if options.validate:
        validate_recorded(input_path, raw_input, value)
        print(f"validated {input_path.parent / EVIDENCE_NAME}")
        return 0

    evidence = build_evidence(input_path, raw_input, value)
    outputs = {
        input_path.parent / EVIDENCE_NAME: render_json(evidence),
        input_path.parent / RESULTS_NAME: render_markdown(evidence),
    }
    if options.check:
        for output_path, expected in outputs.items():
            actual, _ = read_utf8(output_path)
            if actual != expected:
                raise EvidenceError(f"generated output is stale: {output_path}")
        print("source-shard token evidence is byte-identical")
        return 0

    for output_path, output in outputs.items():
        output_path.write_bytes(output)
        print(f"wrote {output_path}")
    return 0


def main() -> int:
    try:
        return run(sys.argv[1:])
    except EvidenceError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
