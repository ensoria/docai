# DocAI HTTP — HTTP API Documentation Format for AI/LLM

DocAI HTTP is a documentation format for describing HTTP APIs in a way that is optimized for AI/LLM consumption.
It is designed so that an AI can read the API documentation as context and efficiently implement an HTTP client that calls the API correctly. Browser-specific requirements are included where they affect web clients, but the format also supports mobile, server, desktop, and CLI clients.

> Specification version: 0.10.1 | status: Draft

> Publication label: design-review draft only; not generator-implementation-ready or stable.

This is a pre-1.0 design-review draft and is not yet declared ready for generator implementation. It may be published as an initial public design-review draft only when that label is preserved; it must not be presented as an initial stable release, a 1.0 release, or generator-implementation-ready. Its structure may change incompatibly while implementation experience and conformance fixtures are collected. Stable compatibility guarantees begin with specification version 1.0.0. Changes are recorded in the repository history and [CHANGELOG.md](CHANGELOG.md). Keeping detailed draft history outside this README reduces tokens for readers that only need the current format rules. The readiness requirements are defined in §9.1.

### LLM Reader Quick Path (non-normative)

Readers that need to use a generated DocAI HTTP set do not need to load this entire specification. For task implementation, prefer the generated set's own retrieval path: `INDEX.md` → selected `CONVENTIONS.md` sections → selected resource/workflow/webhook files(§7.1).

For understanding this specification with minimal context, load §3.2 for `INDEX.md`, §3.3 for `CONVENTIONS.md`, §4.1 for endpoint structure, and §7.1 for the retrieval recipe. Producers, validators, and specification reviewers should read the full document, especially the compatibility rules(§3.1), output profiles(§3.4), canonical syntax and boundaries(§3.5), and conformance requirements(§9.1).

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Core Principles](#2-core-principles)
- [3. File Structure](#3-file-structure)
- [4. Endpoint Definition Format](#4-endpoint-definition-format)
- [5. Workflow Definitions](#5-workflow-definitions-workflows-optional)
- [6. Webhook Definitions](#6-webhook-definitions-webhooks-optional)
- [7. Cross-Cutting Requirements and Writing Style](#7-cross-cutting-requirements-and-writing-style)
- [8. Relationship with OpenAPI](#8-relationship-with-openapi)
- [9. Compliance Checklist](#9-compliance-checklist)

---

## 1. Overview

DocAI HTTP is a documentation format for describing HTTP APIs in a way that is optimized for **LLMs to understand and use**. OpenAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, DocAI HTTP has one purpose: **allow an LLM to load the documentation into context and write correct API-calling code on the first attempt**.

DocAI HTTP is designed to be **generated from one authoritative input set** (an OpenAPI document, code annotations, pass-through convention or workflow content, or similar), not hand-maintained as duplicated output files. The format deliberately duplicates information for the LLM's benefit (see Core Principles), and that duplication is only safe to maintain when a generator produces it from that authoritative input set. **Hand-editing the duplicated parts of a generated DocAI HTTP is discouraged**, because edits will drift between copies. This discouragement applies only to the duplicated parts(resource files): `CONVENTIONS.md` and `workflows/` typically contain knowledge absent from the machine-readable source, so they may be hand-maintained — or maintained as inputs the generator passes through(the generator still stamps them).

This document defines only the **format rules**. It does not cover tools or generator implementations.

Terminology used throughout: the **generator**(also called the producer) is the tool that emits a DocAI HTTP document set from the authoritative source. A **reader** is any consumer of a generated set — an LLM loading it as context, or a validation tool. A **document set** is every file produced by one generation run for one profile(§3.4).

### Why DocAI HTTP is needed instead of only OpenAPI

OpenAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` — understanding one endpoint requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- Side effects, call order, and business rules have no standardized required fields, so their location and completeness vary by source

DocAI HTTP reverses these tradeoffs: **no cross-file schema/object references, flat structure, required examples for representable non-empty bodies, and required behavior descriptions**. Cross-file links are allowed for navigation and context selection, such as `CONVENTIONS.md`, `Also read`, workflows, webhooks, and source locations named by `**unsupported**:`. Common error-shape labels are the only cross-file contract references: they may point from endpoint error rows to `CONVENTIONS.md` because common error handling is an API-wide convention, not a shared resource object.

## 2. Core Principles

1. **Self-contained with conventions** — An endpoint definition must be fully understandable when read together with `CONVENTIONS.md`. The normal read order is `INDEX.md` → `CONVENTIONS.md` → the selected resource/workflow/webhook file. An INDEX may identify only the convention sections needed for an endpoint; when it does, the CONVENTIONS.md metadata stamp and those sections replace the whole file in the normal read order(§3.2). Even common schemas and shared domain objects(such as `User`, `Money`, `Address`) must be expanded inline in each endpoint; within a single file, the `compact` profile may replace repeated semantically identical request-body or response-body definitions of the same kind with a `**same_as**:` back-reference(§3.4). When `**same_as**:` is used, self-containment is guaranteed at the producer's intended retrieval-unit level, not necessarily at the single-endpoint chunk level: that retrieval unit must include the referenced earlier representation with the referring operation. Duplication is acceptable when it lowers the total context needed for a task. Whether duplication or reference resolution is cheaper must be evaluated against representative documents and target models rather than assumed. Consistency across duplicated copies is the **generator's responsibility**(§1); keeping them in sync by hand is discouraged. The only content factored out of endpoint definitions into another file is API-wide conventions, which live in CONVENTIONS.md(§3.3) — shared *objects* are not conventions and are still inlined.
2. **Example-first** — Every representable non-empty request body and response body must include realistic concrete examples. Field tables supplement examples with constraints and presence rules. A body representation that cannot be emitted faithfully uses the explicit `unsupported` replacement form in §3.4 rather than a guessed example. Authoritatively established body-less requests/responses must explicitly say `none`; missing body knowledge uses the `unknown` form in §3.4. In the `compact` profile, a later request or response body may use `**same_as**:` instead of repeating a semantically identical earlier definition of the same kind.
3. **Markdown-based** — DocAI HTTP uses structured Markdown and fenced code blocks so that examples and implementation guidance remain readable to an LLM and a human. DocAI HTTP must not be a YAML/JSON-only definition file.
4. **Deterministic structure** — Section order, heading levels, and required section roles are fixed. All structural text — fixed headings, table column headers, canonical keys, markers, and fixed values — is written in English regardless of the document language(§4.1); only prose is written in the document language. An LLM should be able to predict where information exists just from knowing the DocAI HTTP format.
5. **Describe behavior** — Side effects, idempotency, preconditions, error-time state, and other information that cannot be inferred from signatures must be required.
6. **Bounded resource files** — Group endpoints by resource, but split a large resource into task-oriented shards(such as `users-read.md` and `users-write.md`) so that only the context needed for the task has to be loaded. Each endpoint appears in exactly one resource file.

## 3. File Structure

```
docs/
  INDEX.md          # Required: list of all endpoints, one-line summary each
  CONVENTIONS.md    # Required: API-wide conventions
  resources/
    users.md        # Endpoint definitions grouped by resource
    orders.md
  workflows/
    checkout.md     # Optional: procedures spanning multiple endpoints
    user-onboarding.md
  webhooks/
    payment-completed.md  # Optional: webhooks the API sends
```

Because files are loaded **individually**(that is the point of splitting), freshness cannot live only in INDEX.md. Every file — INDEX.md, CONVENTIONS.md, and each file under resources/, workflows/, and webhooks/ — must begin with a one-line metadata stamp so an LLM that loaded only that file can judge how current it is and how much detail it contains:

```markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-06-30 | generation_id: full-20260630-abc123 | projection_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_revision: sha256:abc123
```

The stamp is one Markdown blockquote line of `key: value` pairs separated by an unescaped ` | `. The standard keys from `docai-http` through `source` are required and appear in exactly the order shown above. `source_revision` is the only optional standard key; when no stable revision can be produced, omit the entire ` | source_revision: ...` pair rather than writing `none` or `unknown`. Parse each pair at its first `: `. Values must not contain a newline. Within a value, escape `\` as `\\` and `|` as `\|`; these are the only valid escape sequences. When locating separators, a pipe is escaped when it is immediately preceded by an odd-length run of backslashes. After splitting the pairs, decode escapes from left to right. An unknown escape or a trailing unescaped backslash makes the stamp invalid. Extension keys must use the `x-` prefix(§3.1) and come after the standard keys that are present; if `source_revision` is present they follow it, otherwise they follow `source`.

- `docai-http` is the DocAI HTTP format version in `major.minor.patch` form(§3.1).
- `profile` is either `full` or `compact`(§3.4).
- `coverage` is either `complete` or `requires-source`. In INDEX.md it describes the whole set; in every other file it describes that file. Use `requires-source` when the covered scope contains one or more `**unsupported**:` markers, and `complete` otherwise. Coverage reports projection completeness, not format compliance: both values are permitted in a compliant set. Because coverage is intentionally reported at file or set scope, producers that need finer retrieval routing may add ignorable `x-` metadata or INDEX columns under §3.1 and §7.
- `knowledge` is either `complete` or `requires-input`. In INDEX.md it describes the whole set; in every other file it describes that file. Use `requires-input` when the covered scope contains one or more `**unknown**:` markers, and `complete` otherwise. Knowledge reports whether the authoritative inputs supply every required client-relevant fact; it is independent of whether DocAI HTTP can represent supplied facts. Both values are permitted in a compliant set, but a reader must obtain the missing authoritative input before relying on the affected behavior. Because knowledge is intentionally reported at file or set scope, producers that need finer retrieval routing may add ignorable `x-` metadata or INDEX columns under §3.1 and §7.
- `generated` is the generation date in ISO 8601 `YYYY-MM-DD` form.
- `generation_id` identifies one complete generation run. It must be identical in every file in the set and different for every run.
- `projection_id` identifies the logical projection-input snapshot shared by both profiles, including authoritative sources, pass-through content, generator version, and configuration that can affect the content of either profile. The choice to emit `full`, `compact`, or both is not part of this identity; profile-specific serialization choices prescribed by this specification likewise do not make separate snapshots. It must be identical in every file generated from that snapshot, including corresponding `full` and `compact` sets. Change it whenever any shared input that can affect either profile changes. Readers must not combine a compact set with a full set whose `projection_id` differs.
- `source` is the source document(s) or source system(s) used to generate the file. Include the source specification and exact version when applicable, such as `openapi.yaml (OpenAPI 3.1.1)`.
- `source_revision` is an opaque stable revision identifier covering the input(s) used to generate that file, including pass-through inputs such as hand-maintained `CONVENTIONS.md` or workflow content when they are stamped by the generator. When it is a cryptographic content hash, prefix the value with the lowercase algorithm name, such as `sha256:abc123...`; the producer defines and consistently applies canonicalization. Omit it only when no stable revision can be produced.

A document set is always regenerated **as a whole**: one generation run re-stamps every file in the set with the same `generated` date, `generation_id`, and `projection_id`(`coverage`, `knowledge`, `source`, and `source_revision` may differ per file as defined above). Files with different `generation_id` values must not be treated as one consistent profile set. The date is informational and is not sufficient to establish set consistency. Corresponding profile sets may have different `generation_id` values, but must share a `projection_id`.

**Format compliance and implementation readiness are different judgments.** A set is format-compliant when it satisfies this specification, including the required signaling of incomplete information. A format-compliant set is **implementation-ready** only when its INDEX.md has both `coverage: complete` and `knowledge: complete`; because INDEX.md summarizes the whole set, this means no operation requires source fallback or additional authoritative input. A set using `requires-source` or `requires-input` remains format-compliant but is not implementation-ready, and a reader must not treat compliance alone as permission to guess the missing contract.

Implementation readiness is a whole-set judgment. For task-scoped retrieval, a selected operation may still be **selected-operation-ready** when the selected INDEX row, required `CONVENTIONS.md` sections, resource retrieval unit, and relevant `Also read` files contain no `**unknown**:` or `**unsupported**:` marker for facts needed by that operation. This does not make the whole set implementation-ready; it only means the selected task can be implemented without relying on unrelated incomplete operations.

### 3.1 Format Versioning and Compatibility

DocAI HTTP uses semantic `major.minor.patch` versions:

- `major` changes when an existing compliant document can change meaning, or when a reader must understand a new required structure to use the document correctly.
- From 1.0.0 onward, `minor` adds backward-compatible optional structures or capabilities. A reader must process a document with a newer minor version of a supported major version by ignoring optional structures it does not understand under the self-bounding rules below.
- `patch` clarifies wording or fixes examples without changing document meaning or required structure.

Before 1.0.0, the format is unstable: an incompatible draft change increments the minor version and resets patch to zero, while a compatible clarification increments patch. A pre-1.0 reader must reject a newer pre-1.0 minor version unless it explicitly supports that specific minor version; it may process newer patch versions of a supported pre-1.0 minor version. From 1.0.0 onward, the major/minor/patch rules above apply without this draft exception.

Normative requirement words have the following meanings throughout this specification, whether lowercase or uppercase: `must` / `required` means mandatory for compliance; `must not` means prohibited; `should` / `recommended` means there may be a valid reason to deviate, but the consequences must be understood; and `may` / `optional` means permitted but not required. In normative sections, imperative instructions such as `Use`, `Write`, `Include`, `Do not`, and `Omit` are normative with the corresponding `must` or `must not` force unless the surrounding text explicitly labels them advisory or non-normative. Descriptive uses that do not express a document-format requirement are not normative.

A reader must reject an unsupported major version rather than guessing; for an LLM reader, rejecting means reporting the unsupported version instead of implementing against the document. It must ignore unknown metadata keys, sections, markers, or table columns whose names begin with `x-`(stamp key `x-team`, heading `#### x-Team Notes`, marker `**x-audit**:`, column `x-Internal`). From 1.0.0 onward, when a document declares a newer minor version of a supported major version, a reader must also ignore unknown standard optional structures that satisfy the self-bounding rules below. Producers must not place information required to call the API correctly only in an `x-` extension or in a standard optional structure added in a minor version. A producer that emits unknown non-extension structural text not defined by its declared DocAI HTTP version creates a non-compliant document. Removing or changing the meaning of an existing required item requires a new major version. Because Markdown headings are structural in DocAI HTTP, producers must not add ordinary non-standard headings such as `### OAuth2` inside standard sections; such headings are unknown non-extension structural text unless this specification defines them. Put required calling information in the standard section's prose, lists, or tables; use an `x-` heading only for ignorable non-contract notes that follow the extension placement rules.

From 1.0.0 onward, a standard structure added in a minor version must be self-bounding so an older reader can skip it without interpreting its contents. It may be a metadata key, a final table column, a one-line marker whose complete value is on that line, or a heading exactly one level deeper than the standard section it extends whose content ends at the next heading of the same level or a shallower level(a numerically equal or lower heading level). It must follow the affected section's previously defined required content and must not split or reorder that content. A new multi-line structure that cannot satisfy one of these boundaries, or information that an existing reader must understand to call the API correctly, requires a new major version.

Extensions must not disrupt the fixed standard structure. An `x-` metadata key follows all present standard stamp keys. An `x-` table column follows every standard column. An `x-` marker appears only after the required standard content in the standard section it extends. An `x-` heading is exactly one level deeper than the standard section it extends, appears after that section's required content, and ends before the next standard section. An extension must not replace, split, reorder, or change the meaning of standard content.

### 3.2 INDEX.md(required)

The entry point that an LLM reads first. Endpoints are listed under a fixed `## Endpoints` section, grouped into **one subsection per resource file**: a `###` heading whose text is the file's path from the docs root, followed by a table with one endpoint per row.

```markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-06-30 | generation_id: full-20260630-abc123 | projection_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_revision: sha256:abc123

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Sends a confirmation email; email is unique across all tenants | workflows/user-onboarding.md | Authentication, HTTP Semantics, Errors |
| GET | /users/{id} | read user | Returns the full user object; no side effects | none | Authentication, Data Representation, Errors |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | From cart validation to order confirmation | workflows/checkout.md |
| User onboarding | Create a user and complete confirmation flow | workflows/user-onboarding.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles | webhooks/payment-completed.md |
```

When a matching compact or full profile set exists, the INDEX.md profile-link line appears directly after the metadata stamp:

```markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-06-30 | generation_id: full-20260630-abc123 | projection_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_revision: sha256:abc123
Compact set: ../docs-compact/

# API Index
```

- One endpoint per row. The `###` heading names the file to read, so the LLM picks a subsection, then a row. There is no per-row file column — the heading carries the path once.
- `Endpoints` is always present. If the API exposes no client-callable endpoints, write `none` under it instead of adding resource subsections.
- `Task` contains one or more short client intent labels, each usually 1-3 words in languages that use spaces or a similarly short phrase in other languages. It helps an LLM avoid loading unrelated resource files. Reuse the exact same label for every endpoint that serves the same client task(for example, all checkout endpoints use `checkout`); endpoints serving different tasks get different labels(`create user`, `read user`). Do not invent synonyms for one task. When one endpoint serves multiple tasks, list every label in the same cell separated by `; `, put the primary task first, and do not use a semicolon inside a label. The endpoint still appears in exactly one INDEX row and one resource file.
- `Summary` must add information beyond `Task`(key behavior, side effect, or distinguishing detail) — a summary that only restates the task label is non-compliant. Keep it to one short sentence. A generator may apply a language- and tokenizer-specific budget, but DocAI HTTP does not define a UTF-8 byte limit because byte length is not a language-neutral measure of LLM token cost.
- `Also read` lists extra docs-root-relative files that should usually be loaded for this endpoint, such as workflows. Separate multiple paths with commas. Write `none` when no extra file is normally needed.
- An INDEX in either profile may add the optional `Conventions` column after `Also read`. Its value is a comma-separated list of exact level-two `CONVENTIONS.md` heading text without the leading `## ` prefix(for example, `Authentication, Data Representation`), `all`, or `none`. Values are matched case-sensitively to the fixed headings in §3.3. Omit the column unless the generator can guarantee that selective loading preserves every applicable convention, including convention sections needed to interpret another selected convention section. Conservative producers should omit the column or write `all` until they can prove the dependency set for each endpoint. For example, if cookie authentication in `Authentication` depends on browser `credentials` or CSRF rules in `Browser Security`, both headings must be listed. A reader that does not see this column, or sees `all`, loads all of CONVENTIONS.md. A reader that sees `none` loads only the `CONVENTIONS.md` metadata stamp and no level-two convention sections; this is valid only when the endpoint can be used correctly without any convention section. This column is a retrieval hint only: ignoring it and loading the whole file remains correct. Producers should also measure whether repeated convention-heading lists in INDEX.md cost more tokens than they save for the target retrieval flow; when selective convention loading does not repay its INDEX tokens, omit the column or use `all`. If repeated convention sets dominate INDEX tokens and a retrieval system needs shorter aliases or named convention sets, publish those aliases or sets as out-of-band retrieval configuration or ignorable `x-` hints such as a final `x-convention-set` column; do not replace the canonical `Conventions` cell with aliases. Do not abbreviate convention names or introduce local aliases in this column, because exact heading text is the compatibility contract.
- `Workflows` and `Webhooks` are always present in that order. If matching files exist, list all of them in the corresponding table; otherwise write `none` under the heading.

### 3.3 CONVENTIONS.md(required)

Write API-wide conventions in **one place only**. This is the only cross-file exception that allows repetition to be removed from endpoint definitions. Same-file compact body reuse with `**same_as**:` is governed separately by §3.4 and §4.1. Use the following fixed headings in this order; write `none` under a heading that does not apply:

- `# API Conventions`
- `## Environments` — Base URLs and environments
- `## Versioning` — API versioning convention(path, header, or another method)
- `## Authentication` — Authentication method, token acquisition, authentication state handling, and concrete examples(credential values in examples must be clearly fake placeholders, §7)
- `## Browser Security` — CORS, Cookie, CSRF, and browser `credentials` conventions
- `## Request Formats` — JSON, multipart/form-data, application/x-www-form-urlencoded, and other request formats
- `## HTTP Semantics` — API-wide caching, conditional requests and optimistic concurrency, common success-response headers, request IDs and tracing, content codings such as compression, and other HTTP behavior not assigned to a more specific section
- `## Errors` — Common error response shapes and handling for 401/403/429/500 and other errors shared by endpoints
- `## Validation Errors` — Common field-level error shapes and whether messages may be displayed to users
- `## Pagination` — Pagination convention
- `## List Operations` — Sorting, filtering, and search conventions
- `## Data Representation` — Datetime, IDs, money, and other representation rules
- `## Empty and Omitted Values` — Handling of `null`, empty arrays, empty objects, empty strings, and omitted fields
- `## File Transfer` — File upload and download conventions
- `## Rate Limits` — Limits, response headers, and retry behavior
- `## Webhook Delivery` — Signature verification, sender identification, required receiver response and deadline, retry policy, delivery guarantee, ordering, and the unique delivery/event identifier used for deduplication

When `Errors` or `Validation Errors` is neither `none`, the valid whole-section `unknown` form(§3.4), nor a valid replacement `**unsupported**:` form(§3.4), it must begin with this table:

```markdown
| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 401 | token_expired | standard-error | Access token has expired | Refresh once, then retry once |
| 403 | forbidden | standard-error | Credential lacks permission | Do not retry with the same credential |
```

- `Status` is an exact status, a literal range such as `4XX`, or `default`.
- `code` is the exact machine-readable error code, `none` when the body has no such code, or `unknown` only when the code fact is absent from authoritative inputs and the row carries the required `**unknown**:` marker. Multiple codes use separate rows.
- `Shape` is a stable label matching an `**error_shape**:` block in the same section, `none` when that error has neither a response body nor caller-relevant response headers, or `unknown` only when the body/header contract is absent from authoritative inputs and the row carries the required `**unknown**:` marker. A shape describes the complete body and caller-relevant response-header contract. Rows with the same body but different required headers therefore use different shapes. A shape label uses lowercase ASCII letters, digits, `_`, and `-`, starts with a letter, and is unique across `Errors` and `Validation Errors`.
- `Condition` and `Caller action` follow the endpoint error-table rules, including retryability.

After the table, define every non-`none`, non-`unknown` shape once, in first-use order:

````markdown
**error_shape**: standard-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{"error":{"code":"token_expired","message":"access token expired"}}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Machine-readable code; values are listed in the error table |
| error.message | string | always | no | Developer-facing message; do not display directly to users |

- Response Headers: none
````

Each block uses the same representation rules as an endpoint response: `**error_shape**:`, `**body_presence**:`, then one or more representations beginning with `**media_type**:`. Error shapes must not use `**same_as**:`. Each non-binary, non-stream representation then gives `**body_nullable**:`, an example, and a response field table in that order. A body-less shape writes `none` directly after `**error_shape**:` and has no body markers. Every shape ends with a `#### Response Headers` table or the collapsed line `- Response Headers: none`; this permits body-less errors with caller-relevant headers. A table row maps to exactly one shape label, `none`, or `unknown`, but multiple rows may reuse a shape label only when their complete body and required-header contract is identical. If the same status can return different shapes, separate rows and give an exact selection condition.

For every convention heading, write `none` only when the authoritative inputs affirm that the convention does not apply. If the entire convention heading's applicability or content is not established, use the whole-section form: write `unknown` under that heading, immediately followed by `**unknown**: <missing fact and expected authoritative input or source location>`, and apply `knowledge: requires-input`(§3.4). If only one fact inside an otherwise established convention is missing, emit the established required content, then add the `**unknown**:` marker after the affected content as defined in §3.4.

Each endpoint definition, webhook file, and workflow file implicitly follows `CONVENTIONS.md`. Only deviations must be described in the file itself, inside the section they affect and prefixed with the fixed marker `**deviation**:`(§4.1) so an LLM can locate them. In a webhook file, deviations from the delivery conventions are placed directly after the intro description(§6).

Endpoint-local `none` values do not cancel API-wide conventions. For request headers, response headers, errors, authentication, pagination, rate limits, and other shared calling rules, `none` in an endpoint section means there is no endpoint-specific or status-specific addition in that section; applicable rules in `CONVENTIONS.md` still apply unless the endpoint states a `**deviation**:`.

### 3.4 Output Profiles

DocAI HTTP defines a required `full` profile and an optional `compact` profile. Every compliant projection snapshot has a full set. A producer may additionally generate a compact set, but it must generate that set from the same authoritative input set and projection-input snapshot as the corresponding full set. A compact-only projection is not compliant because intentionally omitted detail would have no canonical fallback.

- `full` — the canonical detailed projection. It preserves all source information needed for a client to construct requests and interpret responses when that information is representable in DocAI HTTP. It is not a lossless serialization of the source schema.
- `compact` — the LLM runtime profile. It reduces examples, redundant prose, table repetition, and opaque response, error, and webhook internals while preserving the complete client-visible contract needed to implement a correct HTTP client without guessing which facts were omitted.

A document set is generated per profile: every file in a set carries the same `profile` value in its stamp. When the optional compact profile is generated, the two sets live in separate roots(for example, the full set in `docs/` and the compact set in `docs-compact/`), share one `projection_id`, and may have different `generation_id` values. The full and compact roots must contain the same standard docs-root-relative file paths for `INDEX.md`, `CONVENTIONS.md`, and every file under `resources/`, `workflows/`, and `webhooks/`; a corresponding file in the other profile is found by resolving the same path under that profile's root. Corresponding files cover the same source scope and therefore have the same `coverage` and `knowledge` values; compact reductions do not hide an unsupported feature or missing authoritative fact. An LLM implementing a client should load the compact set when it exists. It consults the matching full set for expanded examples, prose, or opaque response, error, and webhook internals, not to discover omitted client-visible fields, statuses, constraints, or behavior. Each set's INDEX.md must state the other set's root on one line directly under the metadata stamp, using the fixed labels `Full set:` / `Compact set:`(for example, `Compact set: ../docs-compact/` in the full set), so an LLM that loaded one set can discover the other.

The `compact` profile may apply these reductions:

- Replace a large response, error-shape, or webhook payload field table with compact field tables under the fixed `####` headings `Client-visible fields` and, when needed, `Opaque fields`, in that order when both appear(both are canonical tokens, §4.1). The body markers and response, error, or webhook example come first, followed by `#### Client-visible fields` and its table; if one or more opaque root fields exist, `#### Opaque fields` follows with its table. If no opaque root field exists, omit the `#### Opaque fields` heading entirely. The example includes every client-visible field whose `Presence` is `always` and a representative subset of conditionally present client-visible fields; it may omit a conditionally present client-visible field only when that field does not affect client logic. It may also omit a conditionally present opaque field; for an opaque field whose `Presence` is `always`, it gives a minimal valid realistic value, while descendants inside that opaque value are exempt from the normal example-to-row rule. `Client-visible fields` document every client-visible field, including conditionally present fields omitted from the example. `Opaque fields` document each opaque root field's name, type, presence, nullability, and a short meaning when the client stores or forwards it without inspecting its internals. This reduction applies equally to endpoint success responses, endpoint-specific inline error shapes, common error shapes in `CONVENTIONS.md`, and webhook payload representations.
- For opaque nested response, error-shape, or webhook objects that the client stores or forwards without inspecting, document the root field in `Opaque fields` as `object` or `object[]` with a short meaning such as `store/forward only`. Opaque descendants may be omitted; do not classify request fields or values that client logic inspects as opaque.
- Treat every response, error-shape, and webhook field as client-visible by default. Classify a field as opaque only when an authoritative annotation or explicit projection configuration declares that consumers store or forward the complete value without inspecting its internals. That configuration is part of the projection-input snapshot(§3). Behavior of one known client, a generator heuristic, field size, or an unfamiliar schema is not sufficient evidence. If the classification is not authoritative, keep the descendants client-visible.
- Use minimal valid request examples. Include only required fields and optional fields that materially affect the call.
- Use representative response, error-shape, and webhook examples. Include every client-visible field whose `Presence` is `always` and common conditionally present client-visible fields; omit a rarely used conditionally present field only when it does not affect client logic. Its field-table row remains required.
- Emit a structured example on one line when doing so remains readable and preserves the exact same value. Pretty-print only when line breaks materially help distinguish nesting, variants, or wire semantics.
- Compact field tables retain object and array container rows. Only descendants of a root field documented in `Opaque fields` may be omitted.
- Leave the `Meaning` cell empty for a field whose name and type are self-explanatory(such as `email` or `name`); fill it only when the meaning adds information the field name does not already convey. This applies to prose meaning only — `Presence` and `Nullable` remain subject to the must-not-omit rule below.
- Use the optional one-line marker `**field_defaults**: <column>=<value>` immediately before a compact body-field, request-parameter, structured-parameter-field, or response-header table to omit one or more uniform columns. Separate multiple defaults with ` | `. Valid defaults are `Required=yes|no`, `Presence=always`, `Nullable=yes|no`, and `Meaning=none`. A default is valid only when the named column exists in that table's full-profile form: `Required` applies to request body-field, request-parameter, and structured-parameter-field tables; `Presence` applies to response body-field, error-shape body-field, webhook payload, and response-header tables; `Nullable` applies to request body-field, response body-field, error-shape body-field, and webhook payload tables; and `Meaning=none` applies only to tables whose column is exactly `Meaning`, not `Constraints / Meaning`. `Required=conditional` is not a valid field default because each affected row must retain its exact condition. Every row must have the declared value; `Meaning=none` means every Meaning cell would be empty. Omit each defaulted column from the table; columns not named by the marker remain required and keep their standard order. For validation, reconstruct the logical full-profile column set by reinserting each defaulted column in its standard position with the declared value for every row before applying any rule that depends on that column. Do not emit the marker unless it reduces measured tokens for that table. This token-saving condition is a producer assertion: validators without tokenizer and measurement inputs can validate syntax, placement, and logical reconstruction, but cannot independently prove measured savings. For example, `**field_defaults**: Presence=always | Nullable=no` permits `Field | Type | Meaning` when every field is always present and non-null. Adding ` | Meaning=none` permits `Field | Type` when every Meaning cell is also empty. Request-parameter and structured-parameter-field tables may similarly default `Required`, and response-header tables may default `Presence`.

  ```markdown
  **field_defaults**: Presence=always | Nullable=no

  | Field | Type | Meaning |
  |---|---|---|
  | $ | object | Additional properties forbidden |
  | id | string | User ID |
  | email | string | |
  | name | string | |
  | role | string | `admin` \| `member` |
  | created_at | string | RFC 3339 creation timestamp |
  ```

- For a standardized enum, reference the standard by name only when the API accepts the standard's full set. When the standard's membership can change over time or differs by edition, include the edition, date, source, or a clear instruction that clients must not hard-code the full set and should defer final validation to the server. Otherwise retain every accepted value, including values on which the client does not currently branch. Compact output must not replace a finite non-standard enum with an unspecified category.
- Collapse leading `none` request subsections into one-line list items(`- Path Parameters: none`, `- Query Parameters: none`) as long as the fixed request order is preserved. Once a non-empty `####` subsection begins, later empty subsections retain headings as required by §4.1. This collapse is allowed in **both** profiles; it is repeated here because compact bodies are more often empty.
- Within one resource file, when a later request body representation is semantically identical to an earlier request body representation in the same file, or a later response body representation is semantically identical to an earlier response body representation in the same file, replace the repeated representation documentation with a single `**same_as**:` line(§4.1). A request representation must not reference a response representation, and a response representation must not reference a request representation, because request requiredness and response presence use different table semantics. Backward references only — the full definition must appear at its first occurrence. Use `**same_as**:` only when the intended retrieval unit includes the referenced earlier representation with the referring operation; otherwise keep the later representation self-contained. The media type named in `**same_as**:` is the concrete media type of both the referenced representation and the referring representation.

The compact reductions apply across the complete set. CONVENTIONS.md may use compact examples, `**field_defaults**:`, empty or defaulted `Meaning` cells, and `Client-visible fields` / `Opaque fields` for common error shapes under the same rules as endpoint response and error-shape tables; workflow prose may omit explanation already stated in its structured steps and transitions; and webhook payloads may use `Client-visible fields` / `Opaque fields` under the same rules as responses. Required headings, behavior, recovery instructions, delivery semantics, and the complete client-visible contract remain mandatory.

The `compact` profile must retain every request parameter and field; every client-visible response, error, and webhook field; their types, requiredness or presence, nullability, constraints, defaults, and wire semantics; every caller-relevant response header and its presence rule; every response status and error row; and all information governing authentication, retries, pagination, file transfer, workflows, and state transitions. It may omit only the reductions explicitly listed above. In particular, a producer must not decide that a client-visible contract item is irrelevant merely because one known client does not currently use it.

DocAI HTTP is a client-implementation projection, not a replacement serialization for OpenAPI or JSON Schema. When a source feature that affects client correctness cannot be represented faithfully, the generator must place a canonical `**unsupported**:` marker inside the affected section, set that file's `coverage` to `requires-source`, and set INDEX.md coverage to `requires-source`. It must not silently approximate or omit that feature. Such a file may be format-compliant, but it is not a complete projection and an LLM must consult the authoritative source before implementing the affected operation. A compact document does not use `**unsupported**:` for an allowed compact reduction; matching full content is supplemental rather than a fallback for omitted client-visible contract information.

An `**unsupported**:` marker has one of two canonical value prefixes and placements. The prefixes let a reader distinguish a one-line localized warning from a marker that stands in for a representation or another required unit:

- **Localized unsupported feature** — Use `**unsupported**: localized: <exact feature, scope, and source location>`. When the enclosing required content can still be represented faithfully, emit that required content and put the marker immediately after the smallest table, representation, marker group, or prose block affected by the omitted feature. The emitted content must not approximate the unsupported part. This marker is a one-line warning and does not begin a new representation.
- **Replacement form** — Use `**unsupported**: replaces <unit>: <exact feature and source location>`. When a required content unit cannot be emitted at all without approximating the source, this single marker replaces the normal contents of the smallest affected unit. The unit name must identify the containing standard unit unambiguously, including its status, media type, parameter name, convention heading, workflow section, or shape label when applicable. The unit's standard heading and any independently known operation-level marker remain present. This exception applies only to a request parameter subsection, structured-parameter block, Body, one body representation, Response, one response-header block, Errors, one common or inline error shape, one common or inline error shape's response-header block, any `CONVENTIONS.md` level-two heading, one workflow section, webhook Headers, or webhook Payload. For a non-empty request Body or webhook Payload, retain `**body_required**:` when its value is representable. For a non-empty Response or error shape, retain `**body_presence**:` when its value is representable; retain the `**error_shape**:` label for a common or inline shape. Then put the replacement marker where the first unavailable required item would otherwise occur. It replaces only that smallest unit's otherwise-required media marker, example, table, sample, response headers, convention prose/table, workflow list/table/prose, or other required contents; a reader must not infer any replaced fact. Other representable sibling parameters, representations, responses, errors, shapes, convention sections, workflow sections, and response headers remain fully documented.

The replacement `<unit>` value must use one of these canonical forms:

- `request Path Parameters`, `request Query Parameters`, `request Headers`, `request Cookie Parameters`, or `request Body` for a whole request subsection.
- `structured parameter <location> <name>` for a `##### Fields` block, where `<location>` is `Path Parameters`, `Query Parameters`, `Headers`, or `Cookie Parameters`, and `<name>` is the exact parameter name.
- `request representation <media type>` for one request body representation.
- `Response <status>` for one complete response section.
- `response representation <status> <media type>` for one response body representation.
- `response headers <status>` for the `#### Response Headers` content of one response section.
- `Errors` for the endpoint error section.
- `common error shape <label>` or `inline error shape <status> <code> inline:<label>` for one common or inline error shape. The inline form uses the same status, code, and `inline:<label>` fields as the inline error-shape label, without the trailing `:`.
- `common error representation <label> <media type>` or `inline error representation <status> <code> inline:<label> <media type>` for one representation inside an error shape.
- `common error response headers <label>` or `inline error response headers <status> <code> inline:<label>` for the `#### Response Headers` content of one common or inline error shape.
- `CONVENTIONS <heading>` for one `CONVENTIONS.md` level-two heading, using the exact heading text without `## `.
- `workflow Preconditions`, `workflow Steps`, `workflow State Transitions`, or `workflow Failure and Recovery` for one workflow section.
- `webhook Headers`, `webhook Payload`, or `webhook representation <media type>` for webhook units.

A response-header replacement marker appears directly under the affected `#### Response Headers` heading and replaces the table or `none` line that would otherwise describe that header block. For example:

```markdown
#### Response Headers

**unsupported**: replaces response headers 200: response header contract uses dynamic generated field names at openapi.yaml#/paths/~1reports~1{id}/get/responses/200/headers
```

For example, a recursive JSON request shape whose body requiredness is known uses:

```markdown
#### Body

**body_required**: yes

**unsupported**: replaces request representation application/json: recursive shape at openapi.yaml#/components/schemas/Node
```

If one source `default` response combines error and non-error outcomes and cannot be split faithfully, preserve the mandatory response structure by emitting `### Response default` with a replacement `**unsupported**:` marker. The endpoint's `### Errors` section must also contain a replacement marker for the inseparable error branch rather than `none`. Do not invent body or header details in either section.

```markdown
### Response default

**unsupported**: replaces Response default: mixed error and non-error outcome at openapi.yaml#/paths/~1jobs/get/responses/default

### Errors

**unsupported**: replaces Errors: error branch is inseparable from the mixed default response at openapi.yaml#/paths/~1jobs/get/responses/default
```

Missing authoritative knowledge is different from an unrepresentable source feature. When a fact required by DocAI HTTP is absent from all authoritative inputs, the generator must put `unknown` in the affected canonical value or prose location and add `**unknown**: <missing fact and expected authoritative input or source location>` inside the smallest affected standard section. For constrained marker values or table cells, `unknown` is the canonical value when that specific fact is missing; this includes `**body_required**: unknown`, `**body_presence**: unknown`, `**body_nullable**: unknown`, `**media_type**: unknown`, `Required=unknown`, `Presence=unknown`, `Nullable=unknown`, `Type=unknown`, error-table `code=unknown`, and error-table `Shape=unknown`. `**media_type**: unknown` is valid only when a body representation is known to exist but no concrete media type is established; if multiple representations may exist but cannot be distinguished, use the smallest applicable whole-section `unknown` form instead of inventing representation boundaries. A compact table must not use `**field_defaults**:` for a column that contains any `unknown` value. A standard section or subsection for which this specification permits the complete content `none` may instead contain `unknown` followed immediately by its `**unknown**:` marker when none of that section's content is established; this includes parameter, header, body, Response, Errors, Related, convention, workflow, and webhook sections where applicable. A whole-response `unknown` form is valid only when no response body or response-header details are established for a known response status; if any independently known response body or header fact exists, emit the representable required content and mark only the missing fact as `unknown` under §4.1. Otherwise, the marker follows the affected section's required standard content and does not by itself replace a required key, table, example, or representation. Multiple unknown cells in one table may share one `**unknown**:` marker immediately after that table, but the marker must identify the affected column(s), row names or statuses, missing facts, and expected authoritative input. Set that file's `knowledge` to `requires-input` and set INDEX.md knowledge to `requires-input`; otherwise use `knowledge: complete`. A reader must not interpret `unknown` as `none`, invent the fact, or assume a safe default. It must obtain the named input or report that implementation of the affected behavior is blocked. `coverage` and `knowledge` are independent: a file may simultaneously contain `**unsupported**:` and `**unknown**:`.

Do not use `unknown` for structural identifiers whose grammar is needed to locate or bound content: endpoint method, endpoint path, response status, file path, table column header, parameter/header/field name, `**error_shape**:` label, `common:<label>`, `inline:<label>`, `**same_as**:` target, or replacement `**unsupported**:` unit name. If one of those identifiers, other than endpoint method or endpoint path, is missing from authoritative inputs and the affected unit cannot otherwise be emitted with a valid identifier, use the smallest applicable whole-section `unknown` form. Endpoint method and endpoint path are the endpoint heading and INDEX routing keys; if either is absent or cannot be represented by this specification, a compliant document set cannot include that operation until the authoritative source is corrected or a future DocAI HTTP version defines a representation. If a source value literally equals a fixed sentinel such as `none` or `unknown` in a structural cell, preserve the value only when the surrounding rule can still distinguish it unambiguously; otherwise use the smallest applicable canonical `**unsupported**:` form and point to the source location.

DocAI HTTP 0.10.1 has no recursive-schema reference syntax. Directly or indirectly recursive request, response, error, parameter, or webhook shapes are deliberately outside the intended 1.0.0 representable scope. This specification chooses the conservative first-stable-release path: recursive shapes remain unsupported for 1.0.0 unless a finite, self-contained representation and versioned fixtures are added before the pre-v1.0.0 release-candidate stage. They cannot be represented by finite inline expansion. The generator must use the smallest applicable localized or replacement `**unsupported**:` form above and apply `coverage: requires-source`; it must not truncate the recursion at an arbitrary depth or invent a non-recursive shape.

This is a deliberate reliability choice. Expanding a recursive shape to an arbitrary finite depth would make the generated document appear complete while hiding deeper valid values from the LLM. That would violate the DocAI HTTP requirement to preserve the complete client-visible contract and could cause generated clients to reject, omit, or mishandle valid nested data. Marking the recursive unit as `unsupported` and directing the reader to the authoritative source is preferable to a partial expansion that looks self-contained but is not. Future recursive-schema support would add a new finite representation under the compatibility rules in §3.1; if existing readers must understand that representation to call the API correctly, it requires a new major version.

Before the first stable release, producers targeting APIs where recursive shapes are common should evaluate whether this unsupported-marker behavior is acceptable for implementation-ready projections. If recursive schemas must become representable in 1.0.0, the representation and fixtures must be added before the pre-v1.0.0 release-candidate stage so early readers do not need an avoidable major-version migration. After that stage, adding recursive-schema support should be treated as a post-1.0 compatibility decision under §3.1; if existing readers must understand the new representation to call those APIs correctly, it requires a new major version.

### 3.5 Canonical Syntax and Boundaries

DocAI HTTP remains readable Markdown, but structural constructs have deterministic boundaries:

- Structural text consists of metadata and profile-link lines; Markdown headings; standard tables and their column headers; bold markers whose line has the form `**name**: value`; collapsed fixed `none` list items; Behavior key list items; and the inline error-shape label defined in §4.1. Other sentences, list items, code blocks, and free-text table cells are prose unless their enclosing rule assigns them a structural role. Some headings are fixed literal headings and some are standard variable headings whose grammar is defined by this specification: endpoint headings `## METHOD /path`, INDEX resource headings `### <resource file path>`, workflow title headings `# <workflow name>`, webhook title headings `# <event or group name>`, response headings `### Response <status>`, and compact field-table headings `#### Client-visible fields` / `#### Opaque fields`. These standard variable headings are not unknown structural text merely because their values vary. The `**unknown**:` marker is a one-line marker with the same boundary as other one-line markers. It appears after the required standard content of the smallest affected section, except in the whole-section `unknown` form defined in §3.4, where it follows the `unknown` line that replaces an otherwise `none`-permitted section.
- A standard section begins at its fixed heading and ends at the next heading of the same level or a shallower level(a numerically equal or lower heading level). A one-line marker ends at its newline unless its rule explicitly introduces the example, table, or variant blocks that follow. A request or response body representation begins at `**media_type**:`, `**same_as**:`, or an `**unsupported**:` marker whose value begins with `replaces ` and names one representation. An error-shape representation begins at `**media_type**:` or an `**unsupported**:` marker whose value begins with `replaces ` and names one representation; `**same_as**:` is not valid inside common or inline error shapes. A webhook payload representation begins at `**media_type**:` or an `**unsupported**:` marker whose value begins with `replaces ` and names one webhook representation. A localized `**unsupported**:` marker never begins a representation. In a request Body a representation ends at the next representation marker or an H1-H4 heading; in a response or error it ends at the next representation marker, `#### Response Headers`, collapsed `- Response Headers: none`, or an H1-H3 heading; in a webhook Payload it ends at the next representation marker or an H1-H2 heading. `#### Client-visible fields` and `#### Opaque fields` and their tables remain part of the preceding representation. `#### Response Headers` content is only its header table, collapsed `- Response Headers: none` line, whole-block `unknown` line plus its required `**unknown**:` marker, or replacement `**unsupported**:` marker; any response-level prose after that content belongs to the enclosing response or error shape, not to the Response Headers block. A variant begins at `**variant**:` and ends at the next variant or representation marker, the enclosing representation's Response Headers boundary, or the enclosing Body/Response/Error/Payload boundary.
- A structured-parameter block begins at `**parameter**:` under a `##### Fields` subsection and ends at the next `**parameter**:` marker or an H1-H5 heading. Its marker value is the exact parameter name from the containing parameter table; its optional compact `**field_defaults**:` line and field table or replacement `**unsupported**:` marker are part of the block.
- An inline error-shape label is exactly `<status> <code> inline:<label>:` on one line. Parse it as a status token, one ASCII space, then the exact normalized table-cell code, one ASCII space, `inline:`, the inline shape label, and the final `:`. `status` follows the status grammar below; `code` is the exact normalized `code` table-cell value from the first row that uses the inline shape; and `label` is the exact normalized `Shape` value after `inline:` and must match the following `**error_shape**:` value. When the first row's code cell is the missing-knowledge sentinel `unknown`, the inline label uses the literal token `unknown` in that code position and the row must carry the required `**unknown**:` marker; this is the only valid use of the sentinel inside an inline error-shape label, and it does not represent a literal source error code named `unknown`. A code used in an inline label must not be empty, contain CR or LF, contain the substring ` inline:`, or end with `:`; if an endpoint-specific source error code cannot be represented in this label form, use the smallest applicable replacement `**unsupported**:` form for that inline error shape rather than normalizing the code. The label's block begins with the following `**error_shape**:` marker and ends after that shape's Response Headers content, or after its replacement `**unsupported**:` marker when the whole shape content is unrepresentable. The label is structural even though its status and code values are operation-specific. Including the inline shape label permits multiple rows with the same status and code to select different inline shapes under mutually distinguishable conditions.
- A docs-root-relative file path uses `/` separators and one or more ASCII segments matching `[A-Za-z0-9._-]+`. It must not start with `/`, contain an empty, `.` or `..` segment, use `\`, or contain a query or fragment. Resolve it from the root of the set containing the link. A `Full set:` or `Compact set:` value is instead a relative POSIX directory path resolved from the current set root; it ends in `/`, may begin with one or more `../` segments, and otherwise uses the same segment grammar. It must not be absolute or contain `.` or an embedded `..` segment. These restrictions also make comma-separated `Also read` values unambiguous.
- An endpoint method is an uppercase HTTP token; registered and extension methods are allowed. The endpoint path begins with `/`, excludes a query and fragment, contains no ASCII whitespace, and uses `{name}` for each template parameter. Literal `{` or `}` characters outside template delimiters must be percent-encoded in the path. A template parameter name must be non-empty and must not contain `/`, `{`, `}`, or ASCII whitespace. If the source contains a path or template variable name that cannot be represented by this grammar, the generator must not normalize it silently; the authoritative source must be corrected or a future DocAI HTTP version must define a representation before a compliant set can include that operation. A method and path pair is unique within a set.
- A response or error `status` is an exact three-digit HTTP status from `100` through `599`, a literal class range from `1XX` through `5XX`, or `default`. Exact statuses sort numerically, ranges lexically, and `default` last as specified in §4.1.
- A media type is a valid HTTP media type, except that the `**media_type**:` marker may use the literal value `unknown` under the missing-knowledge rules in §3.4. Emit a concrete media type's type and subtype in lowercase. For DocAI HTTP structural spelling, do not add optional whitespace around media-type parameters, and use one exact emitted spelling consistently wherever the same concrete media type appears in `**media_type**:`, `**same_as**:`, or an `**unsupported**:` replacement unit. Retain parameters only when they affect construction or interpretation, and state the selection rule when parameter values can vary. Use quoted parameter values only when HTTP grammar requires them. If a retained parameter value contains ASCII whitespace or the delimiter sequence `: `, do not use that media type as a `**same_as**:` target; if it must appear in a replacement unit and makes the replacement boundary ambiguous, use the next larger applicable replacement unit instead. `**same_as**:` targets and `**unsupported**:` replacement unit names must use a concrete media type, not `unknown`.
- A table begins at its header row and ends at the first non-table line. Standard tables are parsed from the Markdown source, not from rendered HTML. Each table row must be a pipe-table row whose first non-space character is `|` and whose final non-space character is `|`; split cells on unescaped `|` separators, where `\|` represents a literal pipe inside the cell. The separator row(`|---|...|`) is required and determines the column count together with the header row. Every body row must have the same cell count after splitting.
- For structural comparison of table cells, first split the row, remove the outer boundary cells created by the leading and trailing pipes, trim leading and trailing ASCII spaces from each cell, then decode only table-level escaped pipes(`\|` to `|`). Do not decode HTML entities, interpret Markdown emphasis, or remove code-span backticks for structural values. Other backslashes remain literal unless a more specific rule, such as field-path decoding, defines additional escapes for that cell. Producers should not use Markdown formatting around structural cell values that must match elsewhere, such as parameter names, error codes, shape labels, and file paths.
- A fenced example or sample begins and ends at its Markdown fence. These boundaries, heading levels, fixed order, marker order, table parsing, and cell normalization rules are the basis for validation; visual Markdown rendering is not.

## 4. Endpoint Definition Format

In a resource file, define each endpoint using the following template. A resource file begins with the metadata stamp and then one or more endpoint definitions; do not add a resource-level title or prose wrapper. This keeps endpoint discovery to the fixed `## METHOD /path` headings and avoids spending tokens on file-local navigation that INDEX.md already provides. **Section order, heading levels, and section roles are fixed**: purpose description and optional endpoint markers, `Behavior`, `Request`, one or more `Response <status>` sections, `Errors`, then `Related`. Multiple response sections follow the ordering rules in §4.1. Headings and all other structural text are fixed English tokens(§4.1); only prose is written in the document language. Do not omit sections that do not apply. Write `none` only when authoritative inputs establish that the section does not apply; use the `unknown` form in §3.4 when applicability or content is not established. Leading request subsections whose entire content is `none` may be collapsed into one-line list items(§4.1).

````markdown
## POST /users

Creates a user. Email addresses are globally unique across all tenants.

**call_shape**: POST /users creates a User; requires `users:write`; may return 409 `email_taken` or 422 `validation_failed`

### Behavior

- side_effects: On successful creation, a confirmation email is sent asynchronously
- idempotency: not idempotent without a key; conditionally idempotent when the same `Idempotency-Key` is reused. Send the key from the first attempt when the call may be retried
- preconditions: a tenant must exist (create it via POST /tenants first)
- authorization: `users:write` scope

### Request

- Path Parameters: none
- Query Parameters: none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Idempotency-Key | no | string | Send from the first attempt when the call may be retried, and reuse the same key on retries. A repeated key returns the first result instead of re-executing |

#### Cookie Parameters

none

#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{
  "email": "taro@example.com",
  "name": "Taro Yamada",
  "role": "member"
}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| email | string | yes | no | RFC 5322. Unique **globally**, not only within a tenant |
| name | string | yes | no | 1-100 characters |
| role | string | no | no | `admin` \| `member`. Defaults to `member` when omitted |

### Response 201

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{
  "id": "usr_01HXYZ",
  "email": "taro@example.com",
  "name": "Taro Yamada",
  "role": "member",
  "created_at": "2026-06-11T09:30:00Z"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| id | string | always | no | ULID with `usr_` prefix. Use this in later API calls |
| email | string | always | no | User email address |
| name | string | always | no | User name |
| role | string | always | no | `admin` or `member` |
| created_at | string | always | no | RFC 3339 creation timestamp |

#### Response Headers

| Name | Type | Presence | Meaning |
|---|---|---|---|
| Location | string | always | URL of the created user(`/users/usr_01HXYZ`). Use it to fetch the resource |

### Errors

| Status | code | Shape | Condition | Caller action |
|---|---|---|---|---|
| 409 | email_taken | common:standard-error | email already exists | Use another email. Do not retry |
| 422 | validation_failed | inline:validation-error | Input value is invalid | Show field-level errors in the form. Do not retry |

422 validation_failed inline:validation-error:

**error_shape**: validation-error

**body_presence**: always

**media_type**: application/json

**body_nullable**: no

```json
{
  "error": {
    "code": "validation_failed",
    "message": "input is invalid",
    "field_errors": [
      {"field": "role", "code": "invalid_enum", "message": "role must be admin or member"}
    ]
  }
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| error | object | always | no | Error envelope; additional properties forbidden |
| error.code | string | always | no | Always `validation_failed` |
| error.message | string | always | no | Developer-facing summary; do not display directly to users |
| error.field_errors | object[] | always | no | Field-level validation failures; array items reject additional properties |
| error.field_errors[].field | string | always | no | Request field targeted by the error |
| error.field_errors[].code | string | always | no | Machine-readable validation code |
| error.field_errors[].message | string | always | no | Safe to display next to the target field |

- Response Headers: none

### Related

- Fetch after creation: GET /users/{id}
- List: GET /users
- Workflow: workflows/user-onboarding.md
````

### 4.1 Section Rules

**Heading(`## METHOD /path`)**
- Use the method and path directly as the heading, with the method in uppercase(`GET`, `POST`). Path parameters use `{id}` format.
- Except for the optional deprecation marker described below, write 1-2 sentences immediately after the heading describing why this endpoint is called. Describe the purpose, not the implementation.
- After the purpose description, a generated file may include one optional `**call_shape**:` line that summarizes how the client calls the endpoint and the most important implementation consequences(auth, returned resource, important endpoint-specific errors, or async/pagination behavior). It must fit on one line. Generate it only when the resource file is large enough that in-file navigation offsets the repeated tokens; it is most useful in large compact-profile files. This navigation-savings condition is a producer assertion: validators without tokenizer, retrieval, and measurement inputs can validate syntax and placement, but cannot independently prove measured savings.
- The purpose description and `**call_shape**:` are retrieval and navigation aids. They must not contradict the structured sections that follow; if they do, the document is non-compliant. The structured sections remain the authoritative contract for request construction, response handling, and behavior.
- If the endpoint is deprecated, put a `**deprecated**: <replacement endpoint and migration>` line immediately after the heading, before the description, and prefix its INDEX.md summary with `(deprecated)`. Omit the line entirely otherwise — there is no permanent `deprecated` label.

**Behavior(required)**
- Use these **four canonical keys in this order** so an LLM and validation tools can always locate each fact: `side_effects`, `idempotency`, `preconditions`, `authorization`. Write `none` for any that do not apply
- All structural text is always written in English, even when generated prose is written in another language. Structural text is: every fixed heading this format defines(`API Index`, `Endpoints`, `Workflows`, `Webhooks`, `API Conventions`, `Environments`, `Versioning`, `Authentication`, `Browser Security`, `Request Formats`, `HTTP Semantics`, `Validation Errors`, `Pagination`, `List Operations`, `Data Representation`, `Empty and Omitted Values`, `File Transfer`, `Rate Limits`, `Webhook Delivery`, `Behavior`, `Request`, `Path Parameters`, `Query Parameters`, `Headers`, `Cookie Parameters`, `Fields`, `Body`, `Response <status>`, `Response Headers`, `Errors`, `Related`, `Preconditions`, `Steps`, `State Transitions`, `Failure and Recovery`, `Payload`, `Client-visible fields`, `Opaque fields`); every table column header(`Method` / `Path` / `Task` / `Summary` / `Details` / `Also read` / `Conventions` / `Name` / `Field` / `Type` / `Required` / `Nullable` / `Presence` / `Constraints / Meaning` / `Meaning` / `Status` / `code` / `Shape` / `Condition` / `Caller action` / `From` / `Endpoint / Event` / `To`); the Behavior keys `side_effects` / `idempotency` / `preconditions` / `authorization`; the markers `**call_shape**:`, `**deprecated**:`, `**deviation**:`, `**same_as**:`, `**variant**:`, `**parameter**:`, `**error_shape**:`, `**field_defaults**:`, `**body_required**:`, `**body_presence**:`, `**body_nullable**:`, `**media_type**:`, `**unknown**:`, and `**unsupported**:`; the `unsupported` value prefixes `localized:` and `replaces <unit>:`; the error-shape reference prefixes `common:` and `inline:`; the `(deprecated)` summary prefix and the profile cross-link labels `Full set:` / `Compact set:`(§3.4); the fixed root field name `$`; the fixed values `none` / `unknown` / `all` / `default` / `yes` / `no` / `conditional` / `always` / `full` / `compact` / `complete` / `requires-source` / `requires-input` and the simple type names including `null`; and the metadata stamp keys `docai-http` / `profile` / `coverage` / `knowledge` / `generated` / `generation_id` / `projection_id` / `source` / `source_revision`. Only prose — descriptions, summaries, and free-text cells such as conditions, constraints, and meanings — is written in the document language(§7)
- `side_effects`: list all(email sending, changes to other resources, event publishing, etc.)
- `idempotency`: state whether the endpoint is idempotent and whether it can be retried safely
- `preconditions`: earlier APIs that must be called, required resource state, etc.
- `authorization`: required scope/role(may overlap with `preconditions`; keep auth here)
- When multiple authentication schemes or roles are alternatives, enumerate each valid alternative and explain how the caller chooses one. Put API-wide credential mechanics in `CONVENTIONS.md`
- These facts do not have standardized required fields in OpenAPI and are among the facts LLMs are most likely to get wrong. A source may still carry them in descriptions, links, extensions, annotations, or another input to the generator
- Write `none` only when the authoritative inputs affirm that the fact does not apply. When an authoritative input does not establish a required Behavior fact, write `unknown` as that key's value, add a `**unknown**:` marker after all four Behavior keys, and apply the `knowledge: requires-input` rules of §3.4. Do not infer `none` from an omitted OpenAPI field or an absent description

  ```markdown
  - side_effects: unknown
  - idempotency: unknown
  - preconditions: none
  - authorization: `users:write` scope

  **unknown**: side effects and idempotency are not documented; requires service-owner annotations for POST /users
  ```

**Request / Response**
- For a non-empty request body, put one `**body_required**: yes|no|unknown` line directly under `#### Body`, before its representations. It states whether the entire body may be omitted; it is independent of field-level `Required`. Use `unknown` only with the required `**unknown**:` marker from §3.4. Webhook `Payload` uses the same marker. Do not write this marker when the body is `none`. If requiredness is part of an unrepresentable source feature, follow the replacement rules in §3.4
- For a non-empty response body, put one `**body_presence**: always|<condition>|unknown` line directly under `### Response <status>`, before its representations. Use `always` when every response with that status has a body; otherwise state the exact condition under which the body is present. Use `unknown` only with the required `**unknown**:` marker from §3.4. Detailed error examples and non-`none` common error shapes use the same marker. Do not write this marker when the response body is `none`. If presence is part of an unrepresentable source feature, follow the replacement rules in §3.4
- For each non-empty body representation, put a `**media_type**: <media type>` line unless the representation uses a compact `**same_as**:` reference or the replacement `**unsupported**:` form in §3.4. The marker value may be `unknown` only under the missing-knowledge rules in §3.4 and must carry the required `**unknown**:` marker after the representation's required content. Every represented form except raw binary and an unstructured stream must then have `**body_nullable**: yes|no|unknown`, followed by the **concrete example** and its applicable field table or non-JSON sample rules. Use `unknown` only with the required `**unknown**:` marker from §3.4. `body_nullable` states whether the entire decoded value may be `null`; it is independent of body omission and field nullability. JSON(including `application/*+json`) always uses this marker, including a JSON scalar. XML, CSV, multipart/form-data, and application/x-www-form-urlencoded also use it; it is normally `no` when the wire format has no whole-value null representation. Raw binary and unstructured streams such as SSE omit `body_nullable` and use the sample-and-prose rules below without a field table. NDJSON is an unstructured stream for this rule unless the API defines it as one finite decoded value. The media marker is required even when only one representation exists and that representation is not replaced by `**same_as**:` or `**unsupported**:`. This is deliberate: explicit markers keep every represented body self-describing and simple to validate, and DocAI HTTP accepts their per-body cost instead of defining convention-level defaults
- If a response status is known but the authoritative inputs do not establish whether it has a body, use `**body_presence**: unknown`, then document any independently known representation facts, and add `**unknown**:` after that response's required content. If no response body or header details are established at all, use the whole-section `unknown` form directly under the response heading, followed by its `**unknown**:` marker. If response headers are not established, write `unknown` under `#### Response Headers` followed by its `**unknown**:` marker. The following examples demonstrate `unknown` placement; a complete generated response still satisfies every applicable field-table, root-object, and object-openness rule. For example:

  ````markdown
  ### Response 200

  **body_presence**: unknown

  **media_type**: application/json

  **body_nullable**: unknown

  ```json
  {"id":"usr_01HXYZ"}
  ```

  | Field | Type | Presence | Nullable | Meaning |
  |---|---|---|---|---|
  | id | string | always | no | User ID |

  - Response Headers: none

  **unknown**: response body presence and nullability are not documented; requires service-owner response contract for GET /users/{id}
  ````

  ```markdown
  ### Response 200

  unknown

  **unknown**: response body and headers are not documented; requires source response contract for GET /reports/{id}
  ```

  ```markdown
  #### Response Headers

  unknown

  **unknown**: caller-relevant response headers are not documented; requires source response header contract for GET /files/{id}
  ```
  ```markdown
  ### Response 204

  none

  #### Response Headers

  unknown

  **unknown**: caller-relevant response headers are not documented; requires source response header contract for DELETE /users/{id}
  ```
- A polymorphic representation is the one exception to the immediate example-and-table sequence: after `**media_type**:` and, when required, `**body_nullable**:`, write one or more `**variant**:` blocks as defined below. Do not put an unlabeled representation-level example or table before those blocks
- Use realistic example values(`"taro@example.com"` instead of `"string"` or `"foo"`)
- Prefer an example supplied by an authoritative source when it satisfies the documented representation. A generator-created example must satisfy every machine-verifiable source constraint, including cross-field constraints exposed by the source, and should be checked with the source validator when one is available. It must not invent undocumented enum values, identifiers, state transitions, or business-rule assumptions. If the authoritative inputs do not contain enough information to construct a credible valid example, emit a structurally valid illustrative example, add `**unknown**: valid example values require <expected authoritative input or source location>` after that representation's required content, and apply `knowledge: requires-input`; do not present an unverified guess as authoritative. This is intentional: required examples are part of an implementation-ready projection, not optional decoration. A generator-created example derived from a complete contract and checked against available constraints does not need this marker merely because no source-authored example existed
- In the `full` profile, request examples should be representative valid examples and response examples should show the normal complete shape. In the `compact` profile, request examples should be minimal valid examples, and response examples should be representative examples focused on fields that affect client implementation
- Every field in the example must have a corresponding row in the field table. Include rows for object and array containers as well as their flattened child fields, except for opaque descendants omitted under §3.4 and the root-object `$` row exception defined below
- In the `full` profile, field tables must document every representable field in the source request/response schema, even when a rarely used optional field is absent from the example. Mark any unrepresentable client-relevant schema feature with the smallest applicable canonical `**unsupported**:` form. Compact examples may be narrower, but compact field tables retain every request field and every client-visible response or webhook field; only opaque descendants may be omitted under §3.4
- Write requests in this order: `Path Parameters`, `Query Parameters`, `Headers`, `Cookie Parameters`, `Body`. If a part does not apply, write `none`
- Leading request subsections whose entire content is `none` may drop the `####` heading and be written as one-line list items directly under `### Request`, keeping the fixed order. When every request subsection is `none`, all five subsections may be collapsed as `- Path Parameters: none`, `- Query Parameters: none`, `- Headers: none`, `- Cookie Parameters: none`, and `- Body: none` in that order. After the first non-empty `####` subsection, later empty subsections retain their `####` heading and contain `none`; this prevents a collapsed item from being parsed as content of the preceding subsection. `#### Response Headers` may likewise be collapsed to a one-line `- Response Headers: none`
- Path parameter tables use the columns `Name | Type | Constraints / Meaning`. There is no `Required` column — path parameters are always required:

  ```markdown
  | Name | Type | Constraints / Meaning |
  |---|---|---|
  | id | string | ULID with `usr_` prefix returned at creation(`usr_01HXYZ`) |
  ```

- Every `{name}` template variable in the endpoint path must have exactly one matching row in `Path Parameters`, and `Path Parameters` must not contain names that are absent from the path. Matching is case-sensitive on the literal template variable name after table-cell normalization(§3.5). If the source contains an unrepresentable template variable name, use the smallest applicable replacement `**unsupported**:` form rather than normalizing it
- Query parameter tables use the columns `Name | Type | Required | Constraints / Meaning`, with defaults and any conditional-requiredness rule in the constraints column. `Required` is `yes`, `no`, `conditional`, or `unknown`; use `unknown` only with the required `**unknown**:` marker from §3.4. For `conditional`, the constraints cell states the exact condition:

  ```markdown
  | Name | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | page | int | no | 1-based. Defaults to `1` |
  | mode | string | no | `standard` \| `custom`. Defaults to `standard` |
  | include | string | conditional | Required when `mode=custom`; `summary` \| `details` |
  ```

  In the compact profile, a valid `**field_defaults**:` line may immediately precede a query parameter table. The same rule applies to request-header and cookie-parameter tables.

- Cookie parameter tables use the same columns as query parameter tables. API-wide cookie attributes and browser behavior belong in `CONVENTIONS.md`; endpoint-specific cookie names, requirements, and deviations belong here
- For every array or object path/query/header/cookie parameter, state the exact wire serialization and give a concrete encoded fragment in `Constraints / Meaning`(for example, `form, explode=true; tag=red&tag=blue`). Also state non-default reserved-character handling. Do not require the caller to infer serialization from the type alone
- For every object parameter or array parameter whose items are objects, add one `##### Fields` subsection after the containing parameter table. Within it, document each structured parameter in parent-table order as `**parameter**: <exact parameter name>` followed by `Field | Type | Required | Constraints / Meaning`; `Required` is evaluated when the containing parameter is present. The marker value is the parameter name exactly as it appears in the parent table and ends at the newline. Use the body field-path notation and escaping rules for nested fields, and retain object and array container rows. The parent parameter row remains the authoritative location for whole-parameter requiredness, wire serialization, and the concrete encoded fragment. A dynamic-key parameter uses `map<string, T>` and `{key}` paths under the same rules as body fields. A pure dynamic map whose value type has no named object fields needs no `Fields` block because its complete value shape is in `map<string, T>`; when `T` contains object fields, document them with `{key}` paths. In the compact profile, a valid `**field_defaults**:` line may appear between `**parameter**:` and its table

  ```markdown
  | Name | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | filter | object | no | deepObject; additional properties forbidden; `filter[status]=active&filter[range][min]=10` |

  ##### Fields

  **parameter**: filter

  | Field | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | status | string | no | `active` \| `disabled` |
  | range | object | no | Additional properties forbidden |
  | range.min | int | yes | Minimum value when `range` is present |
  ```

- For every parameter, use `Constraints / Meaning` to distinguish omission, an empty string, an empty collection, and an explicit null-like wire value whenever more than one is accepted or their effects differ. State whether an empty value is rejected when that fact affects construction. Use `Required=conditional` and state the exact condition in this column when the parameter is required only in a particular request state. Parameter tables intentionally have no `Nullable` column because HTTP parameters do not have one universal null encoding
- For a query or cookie parameter that may occur more than once, state whether occurrences are repeated, delimited, or last-value-wins and give an encoded example. For a request header, state whether multiple field lines are allowed, whether their values may be combined with commas, and any order semantics. Header names are case-insensitive unless the API is non-conforming; document such behavior with `**deviation**:`. State any scalar-specific percent-encoding or reserved-character rule that differs from the applicable convention
- If an endpoint uses a base URL or server different from `CONVENTIONS.md`, put a `**deviation**:` line immediately under `### Request`, before the parameter subsections, and give the exact selection rule and URL
- Endpoint-local `Headers: none` means there are no endpoint-specific request headers beyond applicable common headers and authentication mechanics in `CONVENTIONS.md`. To suppress or change a common request header requirement, add a `**deviation**:` in `### Request` before the parameter subsections and state the exact rule

- If there is no response body, write `none` directly under the `### Response <status>` heading, and still include response headers immediately after it as either `#### Response Headers` or `- Response Headers: none`. This applies to `204`, `HEAD`, redirects whose useful contract is in `Location`, and any other body-less response. For example:

  ```markdown
  ### Response 204

  none

  - Response Headers: none
  ```

  A body-less response with caller-relevant headers uses:

  ```markdown
  ### Response 204

  none

  #### Response Headers

  | Name | Type | Presence | Meaning |
  |---|---|---|---|
  | ETag | string | always | Use as `If-Match` when updating the resource |
  ```
- Add a `#### Response Headers` table when the caller must read response headers. Caller-relevant headers include headers used for pagination or traversal(`Link`), retries and rate limits(`Retry-After`, rate-limit headers), redirects or created-resource lookup(`Location`), optimistic concurrency and caching decisions(`ETag`, `Last-Modified`, `Cache-Control` when the API contract depends on it), downloads(`Content-Disposition`, integrity or checksum headers, size metadata), sessions and browser state(`Set-Cookie`), and tracing or request correlation when the client must propagate or log them. Headers with no client-visible contract may be omitted from DocAI HTTP even when present in the source; preserve them only when the caller must read, store, forward, branch on, display, or log them for correct behavior. Write `none` when there are no status-specific caller-relevant response headers beyond applicable common response-header conventions in `CONVENTIONS.md`. Document headers per status code when they differ(for example, `Retry-After` only on 429). To suppress or change a common response-header rule for one response, add a `**deviation**:` in that response section
- Request header tables use the columns `Name | Required | Type | Constraints / Meaning`. Response header tables use the columns `Name | Type | Presence | Meaning`; `Presence` is `always`, `unknown`, or the exact condition under which the header is present. Use `unknown` only with the required `**unknown**:` marker from §3.4. Header values are strings unless another syntax is stated explicitly in the `Type` or meaning/constraints column. In the compact profile, a valid `**field_defaults**:` line may immediately precede either table
- For every response header that can occur more than once, state whether the client receives repeated field lines, a list-valued field that may be combined with commas, or another exact wire form; state whether order is significant and give a concrete wire example. Do not treat `Set-Cookie` as comma-combinable. For a response header whose grammar itself contains commas, distinguish grammar-level commas from multiple field values. These rules apply equally to success, redirect, common-error, and inline-error response headers
- Response, error-shape, and webhook payload field tables normally use the columns `Field | Type | Presence | Nullable | Meaning`. `Presence` describes whether the field is `always` present, `unknown`, or the condition under which it is omitted. For nested fields, `Presence` is evaluated when the containing body and every ancestor container field are present; any condition under which an ancestor is omitted belongs on that ancestor's row. Use `unknown` only with the required `**unknown**:` marker from §3.4. Compact tables, including `Client-visible fields` and `Opaque fields`, may omit applicable uniform columns, including a uniformly empty `Meaning`, only through a valid `**field_defaults**:` marker(§3.4)
- Both profiles document every response status, literal status range, and `default` response from the authoritative source that a client can observe. Compact may reduce representation tokens only under §3.4; it must not omit a status or error row. Document non-error outcomes as `Response <status>` sections and error outcomes in `Errors`; classify an unusual status by the API's semantics rather than by status class alone
- Every endpoint has at least one `Response <status>` section. Order exact numeric response headings by ascending status, followed by status ranges in lexical order, then `### Response default` when the source default can represent a non-error outcome. A redirect is a response section. A default with exclusively error semantics belongs in `Errors` as a `default` row. If one source default covers both error and non-error outcomes and cannot be split faithfully, use the paired replacement forms for `### Response default` and `### Errors` defined in §3.4. When an exact status and a range or default overlap, document both and state which definition takes precedence, matching the authoritative source
- If there are multiple successful or other non-error responses, split them by status code, such as `### Response 200`, `### Response 202`, and `### Response 204`
- If the source defines a response status range, use the literal range in the heading(such as `### Response 2XX`) and state which concrete statuses the caller should expect. Preserve `default` error responses as a `default` row in `Errors`
- For asynchronous acceptance such as `202 Accepted`, describe the endpoint used to check completion, polling interval, timeout, and failure-time state
- **Redirect responses(3xx)**: document them as `### Response 302`(etc.) with a `#### Response Headers` table containing `Location`, and state whether the client follows the redirect automatically(the `fetch` default) or must read `Location` and act manually(for example, signed download URLs)
- When a request or response supports multiple media types, repeat `**media_type**:`, `**body_nullable**:` except for raw binary or an unstructured stream, example/sample, and the applicable field table for each representation inside the same `Body` or `Response <status>` section. Within one `Body`, `Response <status>`, error shape, or webhook `Payload`, a concrete media type must appear at most once; when one media type has multiple possible shapes, represent them with `**variant**:` blocks under that representation, or use the smallest applicable `**unsupported**:` form if the alternatives cannot be projected faithfully. This keeps representation boundaries and compact `**same_as**:` targets unambiguous. State how the caller selects a request media type and how it should branch on the response `Content-Type`
- Response-level prose required by the preceding rules(status-range precedence, concrete statuses expected from a range, asynchronous polling, redirect handling, or response media-type branching) belongs after that response's body representation(s) and `#### Response Headers` content, before the next `### Response <status>` or `### Errors` heading. For a body-less response, put the prose after `none` and its response-header content. This prose is not part of the Response Headers block for parsing or validation. Representation-specific prose for non-JSON wire semantics remains inside the representation, immediately after its sample and before the next representation marker or response-header boundary.
- **Non-JSON responses**(file download, binary, XML, CSV, Server-Sent Events streaming, etc.): after the `**media_type**:` marker and the required `**body_nullable**:` marker when applicable, give a representative sample fragment plus a prose description of the wire semantics. A structured non-JSON body also uses the applicable standard field table for its logical decoded fields, and the prose maps those fields to wire constructs when the mapping is not direct. For downloads, state how the filename is obtained, the expected or maximum size, and any integrity metadata. For XML, state character encoding, namespaces, attribute-versus-element mapping, and significant ordering or repetition rules. For CSV, state character encoding, header presence, delimiter, quote and escape rules, record separator, and column order. For SSE, state event names, frame and data formats, reconnection and `Last-Event-ID` behavior, and termination condition
- **Non-JSON request bodies**(`multipart/form-data`, `application/x-www-form-urlencoded`, XML, CSV, raw binary upload): after the `**media_type**:` marker and the required `**body_nullable**:` marker when applicable, give a representative fragment, then document the logical parts, form fields, or structured values in the standard request field table and state the wire mapping. Multipart documentation states each part's name, `Content-Type`, filename rules, accepted media types, and maximum size; boundary construction may be delegated explicitly to the HTTP library. Form documentation states character encoding, percent-encoding, and repeated-field rules. XML and CSV state the same format-specific items required for responses. Use the type `file` for multipart file parts. For raw binary bodies, describe the expected content, accepted media types, maximum size, and any required integrity metadata in prose
- Use simple type names: the scalars `string` / `int` / `float` / `bool` / `null` / `any`; `object`; and `file`(multipart file parts only). Arrays use nestable `T[]` notation, including nested arrays such as `int[][]`. Dynamic-key objects use nestable `map<string, T>` notation, including `map<string, string[]>`. Use `null` only when the authoritative source requires the decoded value at that position to be exactly `null`; a row with `Type=null` must have `Nullable=yes`, and a whole body whose decoded value is always `null` uses `**body_nullable**: yes`, a concrete `null` example, and a `$` row with `Type=null`. When a value may be either `null` or one non-null type, use the non-null type and `Nullable=yes`; `null` is not a union syntax. Use `any` only when the authoritative source explicitly permits any decoded value at that position and no narrower client-visible contract exists; it is not a substitute for missing type knowledge. When the type fact is missing, write `unknown` in the `Type` cell with the required `**unknown**:` marker instead. Put formats and semantic constraints such as RFC 3339 in `Constraints / Meaning` or `Meaning`, not in `Type`. Reference notation such as `$ref` is prohibited; the only allowed body reference is the same-file `**same_as**:` line in the compact profile(§3.4). These nestable type expressions do not define recursive schemas; recursive shapes follow the `**unsupported**:` rule in §3.4
- `**same_as**: <METHOD> <path> Request <media type>` or `**same_as**: <METHOD> <path> Response <status> <media type>`(compact profile only) declares that this entire request or response body representation is semantically identical to an earlier body representation of the same kind in the same file and replaces its media marker, body-nullability marker, example/sample, field table, and representation-specific prose. The `Request` form is valid only inside a request `#### Body`, and the `Response` form is valid only inside a `### Response <status>` section; request representations must not reference response representations, and response representations must not reference request representations. The media type in the `**same_as**:` value is the concrete media type of both the referenced representation and the referring representation, using the structural spelling rules in §3.5; a referring representation has no separate media marker. `**same_as**:` must not reference a representation whose media type is `unknown`. The containing request's `body_required` or response's `body_presence` marker remains present and may differ because it describes operation-level body omission or presence, not the representation after a body exists. Representation-level field types, request requiredness or response presence rules, field and body nullability, constraints, defaults, meanings, and wire semantics must all be identical within their respective request or response table semantics. It must point at the full definition, never at another `**same_as**:` line. It must not appear in endpoint-specific inline errors or common error shapes. It is valid only when the document producer's intended retrieval unit includes both the referring operation and the referenced earlier representation; if endpoint-level chunks may be loaded alone, the referring chunk must either include the referenced representation or duplicate the representation instead. Producers must make the intended retrieval unit discoverable to the intended reader or retrieval tool whenever `**same_as**:` appears, using `x-` metadata or published retrieval configuration as described in §7. The `full` profile never uses `**same_as**:` and always duplicates
- Use the fixed field name `$` for the complete structured body value when its root is a scalar, array, or dynamic-key map. Use `$[].id` for fields in root-array objects and `$.{key}.amount` for fields in root-map values. The `$` row carries the complete root type and constraints. Field-table requiredness and presence are evaluated only after the body exists and, for nested fields, after every ancestor container field exists: its explicit or defaulted `Nullable` value must match `body_nullable`, a request `$` row has `Required=yes`, and a response or webhook `$` row has `Presence=always`. `body_required` separately states whether a request or webhook sender may omit the entire body; `body_presence` separately states when a response contains a body. This separation permits semantically identical representations to use `**same_as**:` when their operation-level body markers differ. A root object normally uses its property rows without a `$` row, unless the root object has constraints that cannot be expressed by those rows. For example, a root array response is represented as:

  ```json
  ["admin", "member"]
  ```

  | Field | Type | Presence | Nullable | Meaning |
  |---|---|---|---|---|
  | $ | string[] | always | no | Roles in display order; may be empty |
- Flatten nested objects in the table using dot notation such as `address.city`
- Flatten objects inside arrays using `[]`, such as `items[].id` and `items[].product.name`
- In a field-name segment, prefix each literal `\`, `.`, `[`, `]`, `{`, `}`, or `$` character with `\`. A literal `|` in a field name is written as `\|` for Markdown table parsing; after table-cell normalization(§3.5), the decoded `|` remains a literal field-name character and is not a structural separator. Structural separators and placeholders are the unescaped forms only. Decode field paths by first recognizing unescaped `.`, `[]`, `{key}`, and the root `$`, then removing one escape prefix from each escaped field-path character; compare example property names after this decoding. No other field-path escape is valid. For example, the root property `address.city` is `address\.city`, the root property `$` is `\$`, the property `{key}` is `\{key\}`, and a literal backslash in `a\b` is written `a\\b`. An empty property name or one containing CR or LF cannot be represented and must use the smallest applicable canonical `**unsupported**:` form with its source location. Apply the same rules to discriminator paths and structured parameter fields
- Use `map<string, T>` for objects with dynamic keys(OpenAPI `additionalProperties`), such as `map<string, int>`. Dynamic keys cannot be flattened with dot notation, so put the value shape in the type column and show a representative key in the example. When the value type is an object, flatten its fields with a `{key}` placeholder segment, such as `balances.{key}.amount` — `{key}` rows correspond to the representative key shown in the example(the one case where example fields match table rows by placeholder, not by literal name)
- For every object container in a body or structured parameter, including an object used as an array item, state whether additional properties are forbidden or allowed and, when allowed, their value type. Put the rule in that container row's constraints or meaning cell. For an array whose items are objects, the array row with type `object[]` may carry the item-object openness rule(for example, `array items reject additional properties`); add an explicit `items[]`-style container row only when the item object has constraints that cannot be expressed clearly on the array row. For a root body object, use a `$` container row when needed to carry this rule; for a root structured parameter, use its parent parameter row. The rule may instead come from `CONVENTIONS.md` `Data Representation` when it establishes an API-wide default; every exception is then stated on the affected container row with `**deviation**:` in the enclosing Body, Response, Payload, or parameter subsection. A `map<string, T>` is inherently open with values of `T` and needs no additional-properties statement
- **Tagged polymorphic fields**: after the representation's media-type and body-nullability markers, give each variant its own complete applicable example and field table introduced by `**variant**: <field> = <value>`(for example, `**variant**: type = card`). Each table repeats all common fields used by that variant as well as variant-specific fields; there is no separate common field table. In every variant table, list every allowed discriminator value in the discriminator row's enum constraint, not only that block's value. Order tagged blocks by discriminator value in lexical order
- **Untagged alternatives**: after the representation markers, give each client-relevant alternative a stable prose label using `**variant**: <label>`. The marker may be followed by brief introductory prose explaining how the caller distinguishes the alternative; the complete applicable example and field table then follow. Each table includes common and alternative-specific fields; there is no unlabeled common table. When no introductory prose is needed, the example follows the marker directly. Order untagged blocks by their stable labels. For overlapping alternatives that may be valid simultaneously, explicitly state that combination semantics and add a separately labeled combined `**variant**:` block with a representative combined example; do not present overlapping shapes as mutually exclusive. If the valid set cannot be projected faithfully, use the smallest applicable canonical `**unsupported**:` form rather than inventing a discriminator
- A body with polymorphic content therefore has this canonical order:

  ````markdown
  **media_type**: application/json

  **body_nullable**: no

  **variant**: type = card

  ```json
  {"type":"card","last4":"4242"}
  ```

  | Field | Type | Presence | Nullable | Meaning |
  |---|---|---|---|---|
  | $ | object | always | no | Additional properties forbidden |
  | type | string | always | no | `card` \| `bank`; this variant is `card` |
  | last4 | string | always | no | Last four digits |

  **variant**: type = bank

  ```json
  {"type":"bank","bank_name":"Example Bank"}
  ```

  | Field | Type | Presence | Nullable | Meaning |
  |---|---|---|---|---|
  | $ | object | always | no | Additional properties forbidden |
  | type | string | always | no | `card` \| `bank`; this variant is `bank` |
  | bank_name | string | always | no | Display name |
  ````

  Request variants use the standard request field-table columns instead. Compact field defaults remain available inside each block; opaque-field reduction applies only to response, error-shape, and webhook variants. Before 1.0.0, conformance and token evaluations should check whether repeated complete variant tables create enough cost to justify a self-bounding compact common-field reduction; until such a structure is explicitly defined, every variant block remains complete as described above
- List all enum values in the constraints column. For standardized enums(ISO 4217 currency, country codes, etc.), reference the standard by name instead of enumerating every value only when the API accepts the standard's **full** set; if the set can change over time or differs by edition, include the edition, date, source, or a clear instruction that clients must not hard-code the full set and should defer final validation to the server. If only a subset is accepted, enumerate the subset. These rules apply to both profiles
- `Required=yes` means the field or parameter cannot be omitted in any valid request in the applicable representation or containing object. `Required=no` means it may be omitted in every otherwise-valid request, although its presence or value may affect other fields' conditional rules. `Required=conditional` means omission is valid only when the exact condition stated in `Constraints / Meaning` is false. `Required=unknown` means the requiredness is missing from authoritative inputs and must be paired with the required `**unknown**:` marker from §3.4. For a structured parameter field, the rule is evaluated only when the containing parameter and containing object are present. Omission and `null` are separate concepts
- Request field tables must include `Required` and `Nullable` columns unless a compact table validly defaults and omits a uniform column under §3.4. A row with `Required=conditional` must retain the `Required` column and state its exact condition in `Constraints / Meaning`
- For update endpoints(`PUT` / `PATCH`), mark fields that cannot be changed explicitly(an `Updatable` note in the constraints column, or `not updatable`). Also state the merge semantics of `PATCH`(for example, whether sending `null` clears the field)
- Specify default values when omitted, whether empty strings are allowed, whether empty arrays are allowed, and whether empty objects are allowed
- If a response field may be absent, specify the condition in the `Presence` column. If presence is missing from authoritative inputs, use `Presence=unknown` with the required `**unknown**:` marker from §3.4. If it may be `null`, set `Nullable` to `yes` and state the condition in `Meaning`; if nullability is missing, use `Nullable=unknown` with the required marker
- **Reuse the same example values across endpoints**: the `id` returned by a create example should reappear in the matching GET/list examples(for instance `usr_01HXYZ` everywhere). Consistent fixtures let an LLM trace a value through a whole workflow

**Errors(required)**
- Write rows for errors whose condition, caller action, retryability, or applicability is specific to this endpoint. A row may still reference a common response shape with `common:<label>` when the body-and-required-header contract is defined in `CONVENTIONS.md`. API-wide errors that apply identically to every endpoint, including their conditions and caller actions, belong only in `CONVENTIONS.md`
- When an endpoint-specific row references `common:<label>`, the row defines the endpoint-specific status, code, condition, caller action, and retryability. The referenced common shape supplies only the body-and-required-header contract. If an error that is otherwise API-wide has endpoint-specific applicability, condition, caller action, or retryability, include a row in this endpoint's `Errors` section and, when it differs from the common convention, add `**deviation**:` in `### Errors` before the table. This endpoint row is then authoritative for that endpoint's handling rule while the common shape remains authoritative for the represented body and headers. If the endpoint-specific difference is only suppression of a common error, use the suppression-only form below instead of adding a row.
- If the only endpoint-specific error fact is that one or more common errors do not apply, put a `**deviation**:` line directly under `### Errors` naming the suppressed common status/code/condition, then write `none`. Do not use `none` alone to suppress common errors, because `none` by itself means there are no endpoint-specific error rows and the common errors still apply. For example:

  ```markdown
  ### Errors

  **deviation**: common 404 `not_found` does not apply because this endpoint creates a new resource rather than reading an existing one

  none
  ```

- Use `Status | code | Shape | Condition | Caller action`. Write `none` instead of a table when there are no endpoint-specific error rows; common errors in `CONVENTIONS.md` still implicitly apply unless a deviation says otherwise. Use the replacement `**unsupported**:` form instead when endpoint-specific error content is known to exist but cannot be represented faithfully
- `code` is the exact machine-readable error code, `none`, or `unknown` under §3.4. Multiple codes use separate rows. `Shape` is `common:<label>` for a complete body-and-required-header contract defined in `CONVENTIONS.md`, `inline:<label>` for one defined later in this endpoint's Errors section, `none` when the error has neither a response body nor caller-relevant response headers, or `unknown` under §3.4. A common label must match an `**error_shape**:` block in `Errors` or `Validation Errors`; an inline label follows the same label grammar and is unique within the endpoint. A row with `code=unknown` may still use `inline:<label>` when the body/header contract is known; its inline label uses the literal `unknown` code token under §3.5 and the row carries the required `**unknown**:` marker for the missing code. A row whose `Shape` is `unknown` has no inline shape block; the required `**unknown**:` marker identifies the missing body/header contract
- Always fill `Condition` and `Caller action`; the `Caller action` cell must explicitly say whether and when the caller may retry, must not retry, or must refresh/re-authenticate before retrying. When an error can leave server-side state changed, partially changed, reserved, locked, queued, or otherwise relevant to recovery, state that error-time state in `Caller action` or in response-level prose for the affected non-error response. If the same error-time state applies across multiple errors, it may instead be stated once in `Behavior` `side_effects` with endpoint-specific error rows pointing to the relevant recovery action. Retryability is intentionally part of `Caller action` rather than a separate structural column, so syntax validators can require the cell to be present but cannot fully validate the prose. This information lets an LLM write error handling code. If the same status and code can select different shapes or actions, use separate rows with mutually distinguishable conditions
- Include an inline concrete error response example and response field table when the shape is not defined in CONVENTIONS.md or when the endpoint returns endpoint-specific field-level errors. Put `**error_shape**: <label>`, `**body_presence**:`, `**media_type**:`, and `**body_nullable**:` except for raw binary or an unstructured stream before the example, in that order. Inline error shapes must not use `**same_as**:`. A body-less inline shape writes `none` directly after `**error_shape**:`. Errors that use `common:<label>` need only their table row
- Precede every inline shape block with a one-line label `<status> <code> inline:<label>:` from the first table row that uses it(for example, `422 validation_failed inline:validation-error:`). The row's `Shape` cell maps later rows that reuse the block
- After the table, define inline shapes in first-use table-row order. The label after `inline:` must exactly match the corresponding block's `**error_shape**:` value. If multiple rows reuse one inline shape, define it once and use the same `inline:<label>` value for every applicable row
- End every inline shape with a `#### Response Headers` table or the collapsed line `- Response Headers: none`. Put headers the caller must read immediately after that error's example and field table, or immediately after `none` for a body-less shape. Reused inline shapes must have an identical body and required-header contract
- For errors that should be displayed in forms or input UIs, include a field-level error response example
- For field-level errors, specify the target field name, machine-readable code, and whether the message can be shown to users

**Related(required)**
- Mention endpoints that are commonly called before or after this endpoint. This helps an LLM assemble the full workflow
- If a related workflow exists, link to it, such as `Workflow: workflows/checkout.md`
- Write `none` when authoritative inputs establish that no related endpoint, workflow, webhook, or other client-relevant follow-up exists. If related-call knowledge is not established, use the whole-section `unknown` form from §3.4

**Deviations from CONVENTIONS.md**
- Write a deviation inside the section it affects, prefixed with the fixed marker `**deviation**:`(for example, `**deviation**: this list API uses offset pagination instead of cursors`). The fixed marker lets an LLM find every deviation in a file

## 5. Workflow Definitions (workflows/, optional)

Operations that require multiple endpoints to be called in a specific order should be written as workflows.

```markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-06-30 | generation_id: full-20260630-abc123 | projection_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_revision: sha256:abc123

# Checkout

Procedure until order confirmation.

## Preconditions

- The cart exists and contains at least one item

## Steps

1. POST /carts/{id}/validate — Pass the cart `id`. If 409 occurs, adjust quantities and retry this step. Pass the same `cart_id` to step 2 after validation succeeds
2. POST /payments — Pass `cart_id`. Keep the returned `payment_id`. If 402 occurs, collect a different payment method and retry this step
3. POST /orders — Pass `cart_id` and `payment_id`. If 410 occurs, the payment expired; restart from step 2. Inventory is reserved only when this step succeeds

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |
| payment.pending | POST /orders succeeds | order.confirmed |

## Failure and Recovery

- If more than 15 minutes pass between steps 2 and 3, the payment expires and POST /orders returns 410. Restart from step 2
```

- Use the fixed headings `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery` in that order. Write `none` when a section does not apply.
- The workflow title heading `# <workflow name>` is required. The title should match the `Name` cell in INDEX.md unless the INDEX name is a shorter retrieval label.
- If a workflow section's applicability or content is not established, use the whole-section `unknown` form from §3.4 under that heading and apply `knowledge: requires-input`.
- Use a numbered list to express order. For each step, write "values passed to the next step" and "failure branches".
- State-transition tables use `From | Endpoint / Event | To`. Include every transition relevant to completing or recovering the workflow.
- If a workflow has a convention deviation that applies to the whole procedure, put a `**deviation**:` line directly after the intro description. If a deviation applies only to one workflow section, put it directly under that section heading before the section content. Endpoint-specific deviations still belong in the affected endpoint file.
- Workflow files must be discoverable from the `Workflows` section in INDEX.md.
- Related endpoints must also reference the workflow from their `Related` section.

## 6. Webhook Definitions (webhooks/, optional)

Webhooks are calls in the reverse direction: the API sends an HTTP request to a URL registered by the client. They may originate from an OpenAPI top-level `webhooks` field or another source and are documented apart from resources — one file per event(or per group of closely related events). DocAI HTTP is not tied to one OpenAPI version; a generator must identify its exact input in `source` and mark client-relevant input features it cannot project with `**unsupported**:`.

A webhook group file is valid only when the grouped events share the same event-specific headers, delivery deviations, related trigger description, and receiver handling requirements, and when their payload differences can be represented as one payload with `**variant**:` blocks under §4.1. If headers, delivery deviations, related triggers, receiver requirements, or payload selection rules differ in a way that cannot be represented faithfully in that single structure, split the group into one file per event or use the smallest applicable `**unsupported**:` form. Grouping is a token and navigation optimization, not a license to merge distinct event contracts.

````markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-06-30 | generation_id: full-20260630-abc123 | projection_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_revision: sha256:abc123

# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

**deviation**: delivery of this event is retried for up to 24 hours, not the default 5 attempts

## Headers

none

## Payload

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{
  "event_id": "evt_01HXYZ",
  "event": "payment.completed",
  "payment_id": "pay_01HXYZ",
  "amount": 1200,
  "occurred_at": "2026-06-11T09:31:00Z"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| event_id | string | always | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | always | no | Always `payment.completed` |
| payment_id | string | always | no | ULID with `pay_` prefix. Matches the id returned by POST /payments |
| amount | int | always | no | Settled amount in JPY |
| occurred_at | string | always | no | RFC 3339 timestamp for when the payment settled |

## Related

- Triggered by: asynchronous settlement after POST /payments
````

- Use the fixed headings `Headers`, `Payload`, and `Related` in that order. Write `none` when a section does not apply. A grouped webhook file still has exactly one `Headers`, `Payload`, and `Related` section; event-specific differences must be represented inside those sections without adding non-standard headings.
- The webhook title heading `# <event or group name>` is required. The title should match the `Name` cell in INDEX.md unless the INDEX name is a shorter retrieval label.
- If a webhook section's applicability or content is not established, use the whole-section `unknown` form from §3.4 under that heading and apply `knowledge: requires-input`.
- Event-specific request headers use `Name | Required | Type | Constraints / Meaning` and follow the endpoint request-header rules in §4.1, including repeated field-line handling, comma combination, order semantics, and non-default encoding behavior. API-wide signature headers remain in `CONVENTIONS.md`.
- Write each payload representation with the request-body rules for `body_required`, media type, body nullability, examples, constraints, and wire semantics. Webhook payload tables use `Field | Type | Presence | Nullable | Meaning`, as shown above, rather than request tables' `Required` column. `Presence` is evaluated when the payload body and every ancestor container field are present; `body_required` separately states whether that body may be omitted by the sender.
- For grouped webhook payloads, use the polymorphic `**variant**:` rules in §4.1. Include the event discriminator field or another exact selection rule so the receiver can choose the correct handling branch without relying on file name context alone.
- Delivery conventions shared by all webhooks — signature verification, sender identification, what the receiver must return(status code, response deadline), retry policy(count, interval, when delivery is abandoned), and delivery guarantees(at-least-once or at-most-once, ordering) — belong in CONVENTIONS.md(§3.3) and are **not repeated per event**.
- A webhook file documents only event-specific deviations from those conventions, prefixed with `**deviation**:` and placed directly after the intro description(see the template). When delivery behavior differs for one event or grouped event set, the deviation must state the complete event-specific receiver contract needed by the client, including any changed response status, deadline, retry, ordering, or deduplication rule; do not merely say that it differs from the default.
- Name a unique event or delivery identifier in the payload table's meaning column. Do not use a resource identifier for deduplication when multiple legitimate events can refer to that resource. If no single identifier exists, state the exact composite deduplication strategy.
- Webhook files must be discoverable from the `Webhooks` section in INDEX.md, and endpoints that trigger a webhook must mention it in their `Related` section.

## 7. Cross-Cutting Requirements and Writing Style

The per-section rules in §4.1 are normative. This section adds cross-cutting requirements where it uses normative words or imperative instructions under §3.1, and style guidance where it uses advisory words.

- Keep each file to a measured token budget that loads comfortably in the target model together with the expected code context. Do not use line count as the normative split criterion. Split a large resource into task-oriented resource shards before it exceeds that budget.
- Prioritize retrieval reductions before syntax-level micro-optimizations: select only the task-relevant resource shard and `CONVENTIONS.md` sections, then apply compact examples, `field_defaults`, and `same_as` where measured savings remain. Retrieval choices must still preserve the complete applicable contract.
- Prefer tables, lists, and code blocks over prose.
- Avoid verbose expressions. Write directly and decisively.
- Escape a literal `|` inside a table cell as `\|`(for example, `` `admin` \| `member` ``).
- Use clearly fake placeholder values for credentials, tokens, API keys, and other secrets in every example. A generated document set must never contain a real secret.
- Explicitly state negative facts, such as "this field cannot be updated" or "this API does not paginate". LLMs fill in missing information by guessing, so clearly stating what is not possible prevents hallucination.
- Put metadata information(DocAI HTTP format version, profile, coverage, knowledge, generation date, generation ID, projection ID, source, and source revision when available) at the beginning of **every file**, not only INDEX.md(see §3) — files are loaded individually.
- Do not omit information that affects client implementation. Examples: authentication-failure handling, retry behavior, mapping errors to fields or UI controls, download file name, and upload size limit.
- Distinguish messages that may be used directly as UI copy from messages intended for logs or developers.
- Write each generated DocAI HTTP document set in a **single prose language**. Generated DocAI HTTP must not repeat the same content in multiple languages — choose one output language and use it consistently across INDEX.md, CONVENTIONS.md, and all resource, workflow, and webhook files. Structural text(headings, table column headers, canonical keys, markers, fixed values) is always English(§4.1); the document language applies to prose only.
- Generate `**call_shape**:` only for files where measured navigation savings justify its duplicated facts; this measured-savings condition is a producer assertion unless the validator is given the producer's tokenizer, retrieval, and measurement inputs.
- Generate `**field_defaults**:` only when tokenizer measurements show that the marker and shorter header cost fewer tokens than repeating the defaulted columns; this measured-savings condition is likewise a producer assertion without the relevant measurement inputs. Use `Meaning=none` only when every omitted Meaning cell would contain no client-relevant information.
- Use `**same_as**:` only under the retrieval-unit requirement in §4.1. If the retrieval system normally loads endpoint-level chunks, keep each chunk self-contained or ensure the referenced earlier representation is retrieved with it; otherwise the saved document tokens become extra retrieval work.
- A producer that emits `**same_as**:` must expose the intended retrieval unit to the retrieval system, for example with ignorable `x-` metadata such as `x-retrieval-unit: resource-file` after the standard stamp keys(§3.1), or through retrieval configuration published with the generated set. For a resource file whose whole file is the retrieval unit, the metadata stamp could end with `| x-retrieval-unit: resource-file`. Treat this as part of the `same_as` design, not an optional afterthought: if the retrieval unit is not discoverable by the intended reader or tool, duplicate the representation instead of using `**same_as**:`. Syntax validators can verify the backward reference target, but the retrieval-unit guarantee is a producer assertion unless the validator is given the retrieval configuration.
- When endpoint order within a resource file is otherwise equivalent for task retrieval, place the endpoint containing a commonly reused body representation before endpoints that can refer back to it with `**same_as**:`. Do not worsen task-oriented sharding or navigation merely to create a reference.
- Put API-wide authentication mechanics, common request headers, default media-type selection, and other shared calling rules in `CONVENTIONS.md` when the authoritative inputs establish them. Authentication credential acquisition, refresh, and auth-related headers belong in `Authentication`; default request body formats, content negotiation, and media-type selection belong in `Request Formats`; request IDs, tracing headers, conditional requests, caching, and other HTTP behavior belong in `HTTP Semantics`; rate-limit headers and retry behavior belong in `Rate Limits`. Endpoint files then state only endpoint-specific requirements, selected scopes, and deviations.
- Put an API-wide object-openness default in `CONVENTIONS.md` `Data Representation` when the authoritative inputs establish one. This can remove repeated openness prose and unnecessary root `$` rows; keep every exception explicit under the rules in §4.1.
- Prefer authoritative projection annotations for genuinely opaque response, error-shape, and webhook values. Do not infer opacity to save tokens; without an authoritative annotation or explicit projection configuration, retain the complete client-visible shape(§3.4). When the source of an opaque classification is concise enough to repay its tokens, include it in the `Opaque fields` meaning cell, such as `store/forward only; source annotation x-docai-opaque`.
- Before fixing generator defaults, benchmark representative tasks using both duplication and references. Compare total loaded tokens and correct-call rate for the target models; DocAI HTTP does not assume one strategy is universally cheaper. Maintain a conformance corpus covering each canonical structure and use it for both syntax validation and correct-call evaluations across target models.
- When a compact set exists, load it first and retrieve full-profile detail only for the selected operation. Do not place both complete sets in context by default.
- A producer may add ignorable `x-` metadata such as a tokenizer identifier and measured file-token count after all standard stamp keys(§3.1) when a retrieval system can use it for shard selection, for example `x-tokenizer: o200k_base | x-tokens: 1840`. Token counts without an exact tokenizer identifier are not comparable; omit this metadata when its routing value does not repay its own token cost. A producer may also add final optional `x-` INDEX columns for finer routing, such as `x-coverage: complete|requires-source`, `x-knowledge: complete|requires-input`, `x-retrieval-unit: resource-file`, `x-convention-set: browser-auth`, or a measured resource/retrieval-unit token count tied to the same tokenizer metadata. Use per-row routing columns only when they help the reader avoid loading unrelated source-fallback warnings, missing-input warnings, repeated convention lists, or oversized retrieval units enough to repay their repeated INDEX tokens. These columns are retrieval hints only; they must not contradict the authoritative file and set-level metadata stamps or canonical `Conventions` values, and readers that ignore them remain correct.

### 7.1 Recommended Retrieval Recipe (non-normative)

This subsection is guidance for LLM tools and retrieval systems; it does not add compliance requirements beyond the normative rules above.

For a task that targets one endpoint:

1. Load the compact set's `INDEX.md` when a compact set exists; otherwise load the full set's `INDEX.md`.
2. Select the endpoint row by `Task`, `Method`, `Path`, and `Summary`.
3. Load the selected `CONVENTIONS.md` sections named by the optional `Conventions` column. If the value is `none`, load only the `CONVENTIONS.md` metadata stamp; if the column is absent, `all`, or not trusted by the reader, load all of `CONVENTIONS.md`.
4. Load the resource file named by the selected `###` resource subsection, using the producer's intended retrieval unit when the file contains `**same_as**:` references.
5. Load every `Also read` file that is relevant to the task, especially workflows that define call order or recovery.
6. Consult the matching full set only for expanded examples, prose, or opaque response internals for the selected operation, resolving the same docs-root-relative file path under the full set root; do not load both full and compact sets by default.
7. Stop and report the affected operation as blocked when the selected content contains `**unknown**:` for a fact needed by the implementation, or consult the authoritative source when it contains `**unsupported**:` for a feature needed by the implementation.

This recipe evaluates the selected operation. Markers that appear only in unrelated resource, workflow, or webhook files affect whole-set implementation readiness, but they do not block a selected-operation-ready task.

## 8. Relationship with OpenAPI

- **Conversion is one-directional: authoritative inputs → DocAI HTTP.** DocAI HTTP is a generated artifact. The authoritative input set(OpenAPI document, code annotations, pass-through convention or workflow content, etc.) is the **maintenance source of truth**; DocAI HTTP is the client-implementation projection the LLM reads. Edit the authoritative inputs and regenerate DocAI HTTP — never the other way around.
- DocAI HTTP is not a lossless OpenAPI or JSON Schema representation and is not tied to one OpenAPI version. The `full` profile must preserve every source fact needed to call the API correctly that DocAI HTTP can represent. It must mark an unrepresentable client-relevant feature with `**unsupported**:` and direct the reader to its source location.
- Absence of a required fact from OpenAPI or another authoritative input is not evidence that the fact does not apply. The generator must preserve that distinction through `**unknown**:` and `knowledge: requires-input` rather than emitting `none` or guessing(§3.4).
- The optional `compact` profile may reduce representation tokens only under §3.4, must retain the complete client-visible contract, and must point to its required matching full set; readers verify that match using `projection_id`.
- DocAI HTTP does not replace OpenAPI. They coexist: OpenAPI and other authoritative inputs continue to serve validation, generation, and complete schema semantics; DocAI HTTP serves efficient LLM context.

## 9. Compliance Checklist

A document set is DocAI HTTP-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist
- [ ] The `docai-http` value uses `major.minor.patch`; no unknown non-`x-` structural text is present, and every `x-` extension follows the placement rules of §3.1
- [ ] Every file(INDEX.md, CONVENTIONS.md, resources/, workflows/, webhooks/) begins with a metadata stamp in the fixed unescaped-` | `-separated key order of §3, containing `docai-http` / `profile` / `coverage` / `knowledge` / `generated` / `generation_id` / `projection_id` / `source`, and `source_revision` when available; when `source_revision` is unavailable its whole pair is omitted; stamp values follow the escape-decoding rules and contain no unknown escape sequence or trailing escape
- [ ] A full set exists; all files in one profile set share the same `profile`, `generated`, `generation_id`, and `projection_id`; when a compact set exists, it shares `projection_id` with its full set, the full and compact roots contain the same standard docs-root-relative file paths, corresponding files have identical `coverage` and `knowledge`, and each INDEX.md links the other set's root(§3.4)
- [ ] Each file's `coverage` matches the presence of `**unsupported**:` in its scope, and INDEX.md coverage summarizes the set; each file's `knowledge` likewise matches `**unknown**:` and INDEX.md knowledge summarizes the set; `requires-source` and `requires-input` are treated as compliant but incomplete along their independent dimensions
- [ ] Every `**unsupported**:` marker uses the localized or replacement form in §3.4 at the smallest affected unit, including response-header and workflow-section replacement units when only that block is unrepresentable, names the unsupported feature and source location, preserves independently representable operation-level markers, and does not approximate or silently omit the unsupported contract
- [ ] INDEX.md begins with `# API Index`, includes `Endpoints`, `Workflows`, and `Webhooks` in order, groups endpoints into one `###` subsection per resource file, and fills `Task`, `Summary`, and `Also read` for every endpoint, or writes `none` for an empty section; multiple task labels and an optional `Conventions` column follow §3.2
- [ ] CONVENTIONS.md uses every fixed heading in §3.3, including `HTTP Semantics`, in order; each common or validation error section that is neither `none`, the valid whole-section `unknown` form, nor a valid replacement `unsupported` form begins with the required error table, every row maps to one valid shape, `none`, or `unknown` with its required marker, and each represented shape includes its required body markers, representations, examples, field tables, and response headers
- [ ] The set is written in a single prose language, and all structural text is English(§4.1, §7)
- [ ] Paths, methods, statuses, media types including the limited `**media_type**: unknown` form and concrete media-type structural spelling, structural boundaries, standard variable headings, table syntax and cell normalization, and inline error-shape labels follow §3.5; an operation whose endpoint method or path is absent or unrepresentable is not emitted as a compliant endpoint
- [ ] Every endpoint follows the fixed section structure and order; each endpoint appears in exactly one bounded resource file, and resource files contain no resource-level title or prose wrapper
- [ ] Requests are split in order into path parameters, query parameters, headers, cookie parameters, and body; only leading `none` parts are collapsed into one-line list items; every path template variable has exactly one matching path-parameter row and no extra path-parameter rows are present
- [ ] Every represented array and object parameter states its exact wire serialization with an encoded example; represented object parameters and arrays of objects have complete `Fields` blocks in parent-table order; every represented parameter distinguishes relevant omitted, empty, and null-like values; repeated query/cookie/header values and non-default scalar encoding are explicit; an unrepresentable unit instead uses the replacement `unsupported` form
- [ ] Every endpoint documents all required source responses and follows the response-heading ordering, default-classification, and overlap rules in §4.1
- [ ] Every non-empty request body and webhook payload states `body_required` when representable; every non-empty response and detailed error body states `body_presence` when representable; each represented form that is not replaced by a valid compact `**same_as**:` reference or replacement `**unsupported**:` form starts with `**media_type**:`, followed by `body_nullable` except for raw binary and unstructured streams, and a concrete example; each concrete media type appears at most once within one containing body, response, error shape, or webhook payload, with same-media alternatives represented as variants or `unsupported`; applicable content has the required field table, while raw binary and unstructured streams follow the sample-and-prose exception; error shapes must not use `**same_as**:`
- [ ] Body-less requests and responses explicitly say `none` when authoritatively established or use the valid whole-section `unknown` form when not established; unknown response body presence, body details, and response headers use the canonical `unknown` forms; body omission, whole-body nullability, conditional response-body presence, multiple media types, and response status ranges preserve the caller-visible selection or branching behavior
- [ ] Representable response headers the caller must read are documented(or confirmed as `none`), and each documented header states whether it is always present, conditionally present, or `unknown` with the required marker; headers with no client-visible contract may be omitted; repeatable response headers define their field-line or list syntax, combination rule, order significance, and a concrete wire example
- [ ] Represented request fields and non-path parameters use `Required=yes|no|conditional|unknown`; every `conditional` row retains the column and states its exact condition in `Constraints / Meaning`; represented request field tables also specify nullability; represented response, error-shape, and webhook payload field tables specify presence and nullability relative to the containing body and ancestor containers; any allowed `unknown` cell, including `Type=unknown`, uses the required marker and prevents compact defaulting of that column where defaulting is otherwise possible; structured parameter fields specify requiredness relative to the containing parameter; a compact table may omit a uniform column or uniformly empty Meaning column only through a valid `**field_defaults**:` marker whose logical columns can be reconstructed under §3.4, with measured token savings treated as a producer assertion when measurement inputs are unavailable
- [ ] Every example field, including object and array containers, has a corresponding field-table row, except for opaque descendants and the root-object `$` row exception in §4.1; generated examples satisfy every machine-verifiable source constraint or carry the required unknown-knowledge indication; every opaque root in compact response, error-shape, or webhook payload output retains its name, type, presence, nullability, and store/forward meaning, its opaque classification comes from authoritative annotation or explicit projection configuration, and compact output omits the `Opaque fields` heading when no opaque root exists
- [ ] Compact retains every request parameter and field, every client-visible response/error/webhook field, every status and error row, and all associated constraints and behavior; only reductions explicitly allowed by §3.4 are used
- [ ] Represented types use the defined nestable grammar without implying recursive schema support; `null` is used only for an authoritatively exactly-null decoded value and carries `Nullable=yes`; `any` is used only for an authoritatively arbitrary decoded value, not for missing type knowledge; formats such as RFC 3339 are written in the constraints or meaning column; every represented object container explicitly or conventionally defines whether and with what type it accepts additional properties, with array item object openness expressed either on the `object[]` row or an explicit item container row
- [ ] Root scalar, array, and dynamic-map bodies use the fixed `$` notation; request `$` rows use `Required=yes`, response and webhook `$` rows use `Presence=always`, and operation-level body omission or presence remains exclusively in `body_required` / `body_presence`; root-array and root-map child paths follow §4.1; literal field-name path characters use only the defined field-path escapes and table-level pipe escape
- [ ] No cross-file schema reference notation such as `$ref` is used; `**same_as**:` appears only in the compact profile as a direct backward reference to a semantically identical request or response body representation of the same kind in the same file, names the shared concrete media type, leaves the operation-level body marker present, satisfies the retrieval-unit requirement in §4.1, makes the intended retrieval unit discoverable to the intended reader or tool whenever it appears, and is not used for error shapes
- [ ] Representable array, nesting, `null`, omission, empty-value, and default-value behavior is specified
- [ ] Represented polymorphic forms have no unlabeled example or common table; every tagged or untagged `**variant**:` block has a complete applicable example and field table and follows the ordering and overlap rules in §4.1; an unrepresentable polymorphic form instead uses `**unsupported**:`
- [ ] Client-relevant source features that cannot be projected faithfully are marked with `**unsupported**:` and a source location, and the affected file and INDEX.md use `coverage: requires-source`
- [ ] Missing authoritative facts are written as `unknown` only in the allowed marker, table-cell, prose, or whole-section positions, have a `**unknown**:` marker naming the missing fact and expected input or source location(or one table-level marker identifying all affected unknown cells), and cause the affected file and INDEX.md to use `knowledge: requires-input`; `unknown` is not used for structural identifiers needed to locate or bound content except the inline error-label code token allowed by §3.5, and `none` is used only for an authoritatively established negative fact
- [ ] Recursive shapes are not finitely truncated or approximated; because they are outside the intended 1.0.0 representable scope, they use `**unsupported**:` and `coverage: requires-source`
- [ ] For update endpoints, non-updatable fields and `PATCH` merge semantics are specified
- [ ] Every represented endpoint-specific error uses `Status | code | Shape | Condition | Caller action`; each represented shape resolves to `common:<label>`, one matching `inline:<label>` block with a `<status> <code> inline:<label>:` label, `none`, or `unknown` with its required marker; inline labels for rows with `code=unknown` use the §3.5 sentinel rule; every represented error includes its condition, caller action, retryability, and any error-time state that affects recovery; endpoint-specific deviations from otherwise common error applicability or handling, including common-error suppression, are marked in `### Errors`; and field-level errors identify the target, machine code, and UI-display policy when known
- [ ] The `Behavior` section uses `side_effects` / `idempotency` / `preconditions` / `authorization` in order, writes `none` only when non-applicability is established, and uses `unknown` plus its marker when a required fact is absent from authoritative inputs
- [ ] Deviations from CONVENTIONS.md are marked with `**deviation**:` in the affected section
- [ ] Deprecated endpoints have a `**deprecated**:` line after the heading and `(deprecated)` in their INDEX.md summary
- [ ] Workflow files include a required `# <workflow name>` title, use every fixed heading in §5, are referenced from INDEX.md and related endpoints, document values passed, failure branches, recovery, and relevant state transitions, and place any workflow-specific deviations according to §5
- [ ] Webhook files include a required `# <event or group name>` title, use every fixed heading in §6, are listed in INDEX.md, follow request-header rules for event-specific headers, use represented payload `Presence` independently from body-level `body_required`, group multiple events only when their differences fit the single webhook-file structure and payload `variant` rules, identify a safe deduplication key or strategy when representable and authoritatively known, and are referenced by triggering endpoints

### 9.1 Conformance Fixtures

Conformance fixtures should be created after the format rules have converged enough that the repository can publish a pre-v1.0.0 release candidate. `pre-v1.0.0` is a repository release label or tag, not a valid `docai-http` metadata-stamp version; generated fixture files still use the numeric draft version they test. Before publishing a draft as ready for generator implementation, and before publishing `v1.0.0`, the specification repository must publish at least one complete valid full document set and its matching compact projection. Those example sets must include INDEX.md, CONVENTIONS.md, at least one resource file, one workflow file, and one webhook file, and they must demonstrate selective conventions, common and inline errors, endpoint-specific handling that reuses a common error shape, non-JSON representation rules, grouped webhook payload variants, `unknown`, `unsupported`, response-header replacement `unsupported`, recursive-schema `unsupported`, workflow-section replacement `unsupported`, `field_defaults`, `same_as` with its discoverable intended retrieval unit, optional token-routing `x-` metadata when used, and both non-empty and omitted `Opaque fields` compact cases. Until those example sets exist, a public release may be labeled as a design-review draft, but must not be advertised as ready for generator implementation. The top-level publication label must remain consistent with this evidence: a repository that publishes only the specification text, without the required example sets, is still a design-review draft even if the format rules themselves are internally consistent.

The repository must publish a versioned conformance corpus before the first stable release. The recommended release sequence is: converge the text as a pre-v1.0.0 candidate, publish the complete fixture corpus against that candidate, make only fixture-driven corrections that preserve the intended 1.0 contract, then tag the same contract as `v1.0.0`. That corpus must contain the complete example sets and focused valid and invalid fixtures for every canonical marker, table, table-cell normalization rule, representation class, representation media-type uniqueness rule, structured-parameter block, conditional-requiredness rule, field-path escape, object-openness rule, response-header presence and repetition rule, response-header replacement unit, workflow-section replacement unit, webhook payload rule, webhook grouping boundary, error-shape reference, endpoint-specific common-error deviation and suppression, error-time state recovery rule, compact error-shape field reduction, polymorphic form, metadata escape, optional token-routing `x-` metadata, coverage state, knowledge state, localized and replacement unsupported form, field default, compact opaque-field form, full/compact same-path profile pairing, exactly-null value representation, `same_as` same-kind and retrieval-unit requirements with discoverability, inline error labels whose code token is `unknown`, canonical boundary, extension placement, generated-example validity rule, and format-specific non-JSON requirement. It must also include directly and indirectly recursive-schema source fixtures whose generated projections demonstrate the required `unsupported` forms. Fixtures must declare the DocAI HTTP version they test and must not be silently changed after release; a meaning-changing fixture update follows the compatibility rules in §3.1.

Recursive schemas are deliberately outside the supported scope of this draft and of the intended 1.0.0 stable contract. The first stable release should keep that exclusion explicit and cover it with fixtures, because adding a weak recursive representation immediately before 1.0 would be more dangerous than forcing an explicit source fallback. A future version may define a finite, self-contained recursive representation, but that addition must follow the compatibility rules in §3.1 and must include versioned fixtures before it is advertised as implementation-ready.

Syntax validators should run the valid and invalid fixtures. LLM evaluations should use the same valid corpus to measure correct request construction, response/error handling, workflow completion, and tokens loaded per task. A document set's compliance is determined by this specification; absence of a fixture does not make otherwise non-compliant syntax valid.

Publishing a draft for design review does not declare it implementation-ready or stable. A release advertised as ready for generator implementation must satisfy the first paragraph of this section and demonstrate the replacement `unsupported` forms in its fixtures. A stable release additionally requires the versioned conformance corpus above. These publication labels are independent from whether an individual generated document set is implementation-ready under §3.
