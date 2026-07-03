# DocAI HTTP — HTTP API Documentation Format for AI/LLM

DocAI HTTP is a documentation format for describing HTTP APIs in a way that is optimized for AI/LLM consumption.
It is designed so that an AI can read the API documentation as context and efficiently implement a web frontend that calls the API correctly.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Core Principles](#2-core-principles)
- [3. File Structure](#3-file-structure)
- [4. Endpoint Definition Format](#4-endpoint-definition-format)
- [5. Workflow Definitions](#5-workflow-definitions-workflows-optional)
- [6. Webhook Definitions](#6-webhook-definitions-webhooks-optional)
- [7. Writing Style Rules](#7-writing-style-rules)
- [8. Relationship with OpenAPI](#8-relationship-with-openapi)
- [9. Compliance Checklist](#9-compliance-checklist)

---

## 1. Overview

DocAI HTTP is a documentation format for describing HTTP APIs in a way that is optimized for **LLMs to understand and use**. OpenAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, DocAI HTTP has one purpose: **allow an LLM to load the documentation into context and write correct API-calling code on the first attempt**.

DocAI HTTP is designed to be **generated from a single source** (an OpenAPI document, code annotations, or similar), not hand-maintained. The format deliberately duplicates information for the LLM's benefit (see Core Principles), and that duplication is only safe to maintain when a generator produces it from one authoritative source. **Hand-editing the duplicated parts of a generated DocAI HTTP is discouraged**, because edits will drift between copies. This discouragement applies only to the duplicated parts(resource files): `CONVENTIONS.md` and `workflows/` typically contain knowledge absent from the machine-readable source, so they may be hand-maintained — or maintained as inputs the generator passes through(the generator still stamps them).

This document defines only the **format rules**. It does not cover tools or generator implementations.

### Why DocAI HTTP is needed instead of only OpenAPI

OpenAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` — understanding one endpoint requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- Side effects, call order, and business rules have no standardized required fields, so their location and completeness vary by source

DocAI HTTP reverses these tradeoffs: **no cross-file schema/object references, flat structure, required examples for non-empty bodies, and required behavior descriptions**. Cross-file links are allowed only for navigation and context selection, such as `CONVENTIONS.md`, `Also read`, workflows, webhooks, and source locations named by `**unsupported**:`.

## 2. Core Principles

1. **Self-contained with conventions** — An endpoint definition must be fully understandable when read together with `CONVENTIONS.md`. The normal read order is `INDEX.md` → `CONVENTIONS.md` → the selected resource/workflow/webhook file. Even common schemas and shared domain objects(such as `User`, `Money`, `Address`) must be expanded inline in each endpoint; within a single file, the `compact` profile may replace repeated semantically identical body definitions with a `**same_as**:` back-reference(§3.4). Duplication is acceptable when it lowers the total context needed for a task. Whether duplication or reference resolution is cheaper must be evaluated against representative documents and target models rather than assumed. Consistency across duplicated copies is the **generator's responsibility**(§1); keeping them in sync by hand is discouraged. The only thing factored out of endpoints is API-wide conventions, which live in CONVENTIONS.md(§3.3) — shared *objects* are not conventions and are still inlined.
2. **Example-first** — Every non-empty request body and response body must include realistic concrete examples. Field tables supplement examples with constraints and presence rules. Body-less requests/responses must explicitly say `none`; in the `compact` profile, a request or response body may use `**same_as**:` instead of repeating a semantically identical earlier definition.
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
  webhooks/
    payment-completed.md  # Optional: webhooks the API sends
```

Because files are loaded **individually**(that is the point of splitting), freshness cannot live only in INDEX.md. Every file — INDEX.md, CONVENTIONS.md, and each file under resources/, workflows/, and webhooks/ — must begin with a one-line metadata stamp so an LLM that loaded only that file can judge how current it is and how much detail it contains:

```markdown
> docai-http: 1.0.0 | profile: full | generated: 2026-06-30 | generation_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_sha: abc123
```

- `docai-http` is the DocAI HTTP format version in `major.minor.patch` form(§3.1).
- `profile` is either `full` or `compact`(§3.4).
- `generated` is the generation date.
- `generation_id` identifies one complete generation run. It must be identical in every file in the set and different for every run.
- `source` is the source document(s) or source system(s) used to generate the file. Include the source specification and exact version when applicable, such as `openapi.yaml (OpenAPI 3.1.1)`.
- `source_sha` is the stable revision or content hash covering the input(s) used to generate that file, including pass-through inputs such as hand-maintained `CONVENTIONS.md` or workflow content when they are stamped by the generator. Omit it only when no stable revision can be produced.

A document set is always regenerated **as a whole**: one generation run re-stamps every file in the set with the same `generated` date and `generation_id`(`source` and `source_sha` may differ per file when files have different inputs). Files with different `generation_id` values must not be treated as one consistent set. The date is informational and is not sufficient to establish set consistency.

### 3.1 Format Versioning and Compatibility

DocAI HTTP uses semantic `major.minor.patch` versions:

- `major` changes when an existing compliant document can change meaning, or when a reader must understand a new required structure to use the document correctly.
- `minor` adds backward-compatible optional structures or capabilities. A reader may process a document with a newer minor version of the same major version by ignoring structures it does not understand.
- `patch` clarifies wording or fixes examples without changing document meaning or required structure.

A reader must reject an unsupported major version rather than guessing. It must ignore unknown metadata keys, sections, markers, or table columns whose names begin with `x-`. It may also ignore unknown standard structures when the document declares a newer minor version of a supported major version. Producers must not place information required to call the API correctly only in an `x-` extension. A producer that emits unknown non-extension structural text not defined by its declared DocAI HTTP version creates a non-compliant document. Removing or changing the meaning of an existing required item requires a new major version.

### 3.2 INDEX.md(required)

The entry point that an LLM reads first. Endpoints are listed under a fixed `## Endpoints` section, grouped into **one subsection per resource file**: a `###` heading whose text is the file's path from the docs root, followed by a table with one endpoint per row.

```markdown
> docai-http: 1.0.0 | profile: full | generated: 2026-06-30 | generation_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_sha: abc123

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /users | create user | Create a user; sends a confirmation email | workflows/user-onboarding.md |
| GET | /users/{id} | read user | Fetch one user by id | none |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | From cart validation to order confirmation | workflows/checkout.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles | webhooks/payment-completed.md |
```

- One endpoint per row. The `###` heading names the file to read, so the LLM picks a subsection, then a row. There is no per-row file column — the heading carries the path once.
- `Endpoints` is always present. If the API exposes no client-callable endpoints, write `none` under it instead of adding resource subsections.
- `Task` is a short client intent label, usually 1-3 words in languages that use spaces or a similarly short phrase in other languages. It helps an LLM avoid loading unrelated resource files. Reuse the exact same label for every endpoint that serves the same client task(for example, all checkout endpoints use `checkout`); endpoints serving different tasks get different labels(`create user`, `read user`). Do not invent synonyms for one task.
- `Summary` must add information beyond `Task`(key behavior, side effect, or distinguishing detail) — do not restate the task label. Keep it to one short sentence. A generator may apply a language- and tokenizer-specific budget, but DocAI HTTP does not define a UTF-8 byte limit because byte length is not a language-neutral measure of LLM token cost.
- `Also read` lists extra docs-root-relative files that should usually be loaded for this endpoint, such as workflows. Separate multiple paths with commas. Write `none` when no extra file is normally needed.
- `Workflows` and `Webhooks` are always present in that order. If matching files exist, list all of them in the corresponding table; otherwise write `none` under the heading.

### 3.3 CONVENTIONS.md(required)

Write API-wide conventions in **one place only**. This is the only exception that allows repetition to be removed from endpoint definitions. Use the following fixed headings in this order; write `none` under a heading that does not apply:

- `# API Conventions`
- `## Environments` — Base URLs and environments
- `## Versioning` — API versioning convention(path, header, or another method)
- `## Authentication` — Authentication method, token acquisition, authentication state handling, and concrete examples
- `## Browser Security` — CORS, Cookie, CSRF, and browser `credentials` conventions
- `## Request Formats` — JSON, multipart/form-data, application/x-www-form-urlencoded, and other request formats
- `## Errors` — Common error response shape and handling for 401/403/429/500 and other errors shared by all endpoints
- `## Validation Errors` — Field-level representation and whether messages may be displayed to users
- `## Pagination` — Pagination convention
- `## List Operations` — Sorting, filtering, and search conventions
- `## Data Representation` — Datetime, IDs, money, and other representation rules
- `## Empty and Omitted Values` — Handling of `null`, empty arrays, empty objects, empty strings, and omitted fields
- `## File Transfer` — File upload and download conventions
- `## Rate Limits` — Limits, response headers, and retry behavior
- `## Webhook Delivery` — Signature verification, sender identification, required receiver response and deadline, retry policy, delivery guarantee, ordering, and the unique delivery/event identifier used for deduplication

The common and validation error sections must give a `**media_type**:` marker, an example, and a response field table in that order, using the same field rules as endpoint responses.

Each endpoint definition, webhook file, and workflow file implicitly follows `CONVENTIONS.md`. Only deviations must be described in the file itself, inside the section they affect and prefixed with the fixed marker `**deviation**:`(§4.1) so an LLM can locate them. In a webhook file, deviations from the delivery conventions are placed directly after the intro description(§6).

### 3.4 Output Profiles

DocAI HTTP supports two generated profiles. Both profiles must be generated from the same source of truth.

- `full` — the canonical detailed projection. It preserves all source information needed for a client to construct requests and interpret responses when that information is representable in DocAI HTTP. It is not a lossless serialization of the source schema.
- `compact` — the LLM runtime profile. It reduces token usage while preserving enough information to call the API correctly for frontend or client implementation.

A document set is generated per profile: every file in a set carries the same `profile` value in its stamp. When both profiles are generated, they live in separate roots(for example, the full set in `docs/` and the compact set in `docs-compact/`). An LLM implementing a client should load the compact set when it exists and consult the full set only for detail compact omits. When both profiles are generated, each set's INDEX.md must state the other set's root on one line directly under the metadata stamp, using the fixed labels `Full set:` / `Compact set:`(for example, `Compact set: ../docs-compact/` in the full set), so an LLM that loaded one set can discover the other.

The `compact` profile may apply these reductions:

- Split large response field tables into two tables under the fixed `####` headings `Frontend-visible fields` and `Opaque fields`, in that order(both are canonical tokens, §4.1). A single `**media_type**:` marker and response example come first, followed by the two tables in that order; the example includes the frontend-visible fields and shows each opaque field at its root only. `Frontend-visible fields` are documented normally. `Opaque fields` may be summarized by name, type, and one short meaning when the client normally stores or forwards them without inspecting their internals.
- For opaque nested objects that the client stores or forwards without inspecting, document only the root field in `Opaque fields` as `object` or `object[]` with a short meaning such as `store/forward only`. Do not flatten opaque leaf fields unless client logic reads them.
- Use minimal valid request examples. Include only required fields and optional fields that materially affect the call.
- Use representative response examples. Include common frontend-visible fields and omit rarely used optional fields unless they affect client logic.
- Leave the `Meaning` cell empty for a field whose name and type are self-explanatory(such as `email` or `name`); fill it only when the meaning adds information the field name does not already convey. This applies to prose meaning only — `Presence` and `Nullable` remain subject to the must-not-omit rule below.
- For very large enums, standardized enums, or enums irrelevant to client branching, reference the standard or category instead of listing every value. If the client branches on only a small subset, list the branching values explicitly and state how all other values should be handled.
- Collapse leading `none` request subsections into one-line list items(`- Path Parameters: none`, `- Query Parameters: none`) as long as the fixed request order is preserved. Once a non-empty `####` subsection begins, later empty subsections retain headings as required by §4.1. This collapse is allowed in **both** profiles; it is repeated here because compact bodies are more often empty.
- Within one resource file, when a later request or response body representation is semantically identical to an earlier representation in the same file, replace the repeated representation documentation with a single `**same_as**:` line(§4.1). Backward references only — the full definition must appear at its first occurrence.

The `compact` profile must not omit information that changes how a caller constructs requests, handles errors, follows workflows, authenticates, retries, paginates, uploads/downloads files, or interprets state transitions.

DocAI HTTP is a client-implementation projection, not a replacement serialization for OpenAPI or JSON Schema. When a source feature that affects client correctness cannot be represented faithfully, the generator must place `**unsupported**: <feature and source location>` inside the affected section. It must not silently approximate or omit that feature. Such a file is syntactically valid, but an LLM must consult the authoritative source before implementing the affected operation. A compact document does not use `**unsupported**:` merely to indicate an intentional compact-profile omission; the full set is the fallback for those details.

## 4. Endpoint Definition Format

In a resource file, define each endpoint using the following template. **Section order, heading levels, and section roles are fixed**. Headings and all other structural text are fixed English tokens(§4.1); only prose is written in the document language. Do not omit sections that do not apply. Write `none` instead so that an LLM can distinguish "intentionally none" from "forgotten". Leading request subsections whose entire content is `none` may be collapsed into one-line list items(§4.1).

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

**media_type**: application/json

```json
{
  "email": "taro@example.com",
  "name": "Taro Yamada",
  "role": "member"
}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| email | string | yes | no | RFC 5322. Unique **globally**, not only within a tenant |
| name | string | yes | no | 1-100 characters |
| role | string | no | no | `admin` \| `member`. Defaults to `member` when omitted |

### Response 201

**media_type**: application/json

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
| id | string | always | no | ULID with `usr_` prefix. Use this in later API calls |
| email | string | always | no | User email address |
| name | string | always | no | User name |
| role | string | always | no | `admin` or `member` |
| created_at | string | always | no | RFC 3339 creation timestamp |

#### Response Headers

| Name | Type | Meaning |
|---|---|---|
| Location | string | URL of the created user(`/users/usr_01HXYZ`). Use it to fetch the resource |

### Errors

| Status | code | Condition | What the caller should do |
|---|---|---|---|
| 409 | email_taken | email already exists | Use another email. Do not retry |
| 422 | validation_failed | Input value is invalid | Show field-level errors in the form. Do not retry |

422 validation_failed:

**media_type**: application/json

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
| error | object | always | no | Error envelope |
| error.code | string | always | no | Always `validation_failed` |
| error.message | string | always | no | Developer-facing summary; do not display directly to users |
| error.field_errors | object[] | always | no | Field-level validation failures |
| error.field_errors[].field | string | always | no | Request field targeted by the error |
| error.field_errors[].code | string | always | no | Machine-readable validation code |
| error.field_errors[].message | string | always | no | Safe to display next to the target field |

### Related

- Fetch after creation: GET /users/{id}
- List: GET /users
- Workflow: workflows/user-onboarding.md
````

### 4.1 Section Rules

**Heading(`## METHOD /path`)**
- Use the method and path directly as the heading. Path parameters use `{id}` format.
- Immediately after the heading, write 1-2 sentences describing why this endpoint is called. Describe the purpose, not the implementation.
- After the purpose description, a generated file may include one optional `**call_shape**:` line that summarizes how the client calls the endpoint and the most important implementation consequences(auth, returned resource, important endpoint-specific errors, or async/pagination behavior). It must fit on one line. Generate it only when the resource file is large enough that in-file navigation offsets the repeated tokens; it is most useful in large compact-profile files.
- If the endpoint is deprecated, put a `**deprecated**: <replacement endpoint and migration>` line immediately after the heading, before the description, and prefix its INDEX.md summary with `(deprecated)`. Omit the line entirely otherwise — there is no permanent `deprecated` label.

**Behavior(required)**
- Use these **four canonical keys in this order** so an LLM and validation tools can always locate each fact: `side_effects`, `idempotency`, `preconditions`, `authorization`. Write `none` for any that do not apply
- All structural text is always written in English, even when generated prose is written in another language. Structural text is: every fixed heading this format defines(`API Index`, `Endpoints`, `Workflows`, `Webhooks`, `API Conventions`, `Environments`, `Versioning`, `Authentication`, `Browser Security`, `Request Formats`, `Validation Errors`, `Pagination`, `List Operations`, `Data Representation`, `Empty and Omitted Values`, `File Transfer`, `Rate Limits`, `Webhook Delivery`, `Behavior`, `Request`, `Path Parameters`, `Query Parameters`, `Headers`, `Cookie Parameters`, `Body`, `Response <status>`, `Response Headers`, `Errors`, `Related`, `Preconditions`, `Steps`, `State Transitions`, `Failure and Recovery`, `Payload`, `Frontend-visible fields`, `Opaque fields`); every table column header(`Method` / `Path` / `Task` / `Summary` / `Details` / `Also read` / `Name` / `Field` / `Type` / `Required` / `Nullable` / `Presence` / `Constraints / Meaning` / `Meaning` / `Status` / `code` / `Condition` / `What the caller should do` / `From` / `Endpoint / Event` / `To`); the Behavior keys `side_effects` / `idempotency` / `preconditions` / `authorization`; the markers `**call_shape**:`, `**deprecated**:`, `**deviation**:`, `**same_as**:`, `**variant**:`, `**media_type**:`, and `**unsupported**:`; the `(deprecated)` summary prefix and the profile cross-link labels `Full set:` / `Compact set:`(§3.4); the fixed values `none` / `yes` / `no` / `always` / `full` / `compact` and the simple type names; and the metadata stamp keys `docai-http` / `profile` / `generated` / `generation_id` / `source` / `source_sha`. Only prose — descriptions, summaries, and free-text cells such as conditions, constraints, and meanings — is written in the document language(§7)
- `side_effects`: list all(email sending, changes to other resources, event publishing, etc.)
- `idempotency`: state whether the endpoint is idempotent and whether it can be retried safely
- `preconditions`: earlier APIs that must be called, required resource state, etc.
- `authorization`: required scope/role(may overlap with `preconditions`; keep auth here)
- When multiple authentication schemes or roles are alternatives, enumerate each valid alternative and explain how the caller chooses one. Put API-wide credential mechanics in `CONVENTIONS.md`
- These facts do not have standardized required fields in OpenAPI and are among the facts LLMs are most likely to get wrong. A source may still carry them in descriptions, links, extensions, annotations, or another input to the generator

**Request / Response**
- For each non-empty body representation, put a `**media_type**: <media type>` line first, then the **concrete example**, then the field table for structured content. The marker is required for JSON and non-JSON bodies even when only one representation exists. Raw binary and unstructured stream representations use the sample-and-prose rules below and do not require a field table
- Use realistic example values(`"taro@example.com"` instead of `"string"` or `"foo"`)
- In the `full` profile, request examples should be representative valid examples and response examples should show the normal complete shape. In the `compact` profile, request examples should be minimal valid examples, and response examples should be representative examples focused on fields that affect client implementation
- Every field in the example must have a corresponding row in the field table. Include rows for object and array containers as well as their flattened child fields
- In the `full` profile, field tables must document every representable field in the source request/response schema, even when a rarely used optional field is absent from the example. Mark any unrepresentable client-relevant schema feature with `**unsupported**:`. In the `compact` profile, field tables may be broader than the representative example, but they must not omit fields that affect client implementation
- Write requests in this order: `Path Parameters`, `Query Parameters`, `Headers`, `Cookie Parameters`, `Body`. If a part does not apply, write `none`
- Leading request subsections whose entire content is `none` may drop the `####` heading and be written as one-line list items directly under `### Request`, keeping the fixed order. After the first non-empty `####` subsection, later empty subsections retain their `####` heading and contain `none`; this prevents a collapsed item from being parsed as content of the preceding subsection. `#### Response Headers` may likewise be collapsed to a one-line `- Response Headers: none`
- Path parameter tables use the columns `Name | Type | Constraints / Meaning`. There is no `Required` column — path parameters are always required
- Query parameter tables use the columns `Name | Type | Required | Constraints / Meaning`, with defaults in the constraints column:

  ```markdown
  | Name | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | page | int | no | 1-based. Defaults to `1` |
  ```

- Cookie parameter tables use the same columns as query parameter tables. API-wide cookie attributes and browser behavior belong in `CONVENTIONS.md`; endpoint-specific cookie names, requirements, and deviations belong here
- For every array or object path/query/header/cookie parameter, state the exact wire serialization and give a concrete encoded fragment in `Constraints / Meaning`(for example, `form, explode=true; tag=red&tag=blue`). Also state non-default reserved-character handling. Do not require the caller to infer serialization from the type alone
- If an endpoint uses a base URL or server different from `CONVENTIONS.md`, put a `**deviation**:` line immediately under `### Request`, before the parameter subsections, and give the exact selection rule and URL

- If there is no response body, write `none`
- Add a `#### Response Headers` table when the caller must read response headers(`Location`, `Set-Cookie`, `Retry-After`, `ETag`, `Link`, etc.). Write `none` when there are none. Document it per status code when it differs(for example, `Retry-After` only on 429)
- Request header tables use the columns `Name | Required | Type | Constraints / Meaning`. Response header tables use the columns `Name | Type | Meaning`. Header values are strings unless another syntax is stated explicitly in the `Type` or meaning/constraints column
- Response and webhook payload field tables normally use the columns `Field | Type | Presence | Nullable | Meaning`. `Presence` describes whether the field is `always` present or the condition under which it is omitted. In compact `Opaque fields` tables, `Field | Type | Meaning` is allowed for fields whose internals the client does not inspect
- If there are multiple successful responses, split them by status code, such as `### Response 200`, `### Response 202`, and `### Response 204`
- If the source defines a response status range, use the literal range in the heading(such as `### Response 2XX`) and state which concrete statuses the caller should expect. Preserve `default` error responses as a `default` row in `Errors`
- For asynchronous acceptance such as `202 Accepted`, describe the endpoint used to check completion, polling interval, timeout, and failure-time state
- **Redirect responses(3xx)**: document them as `### Response 302`(etc.) with a `#### Response Headers` table containing `Location`, and state whether the client follows the redirect automatically(the `fetch` default) or must read `Location` and act manually(for example, signed download URLs)
- When a request or response supports multiple media types, repeat `**media_type**:`, example/sample, and the applicable structured-content field table for each representation inside the same `Body` or `Response <status>` section. State how the caller selects a request media type and how it should branch on the response `Content-Type`
- **Non-JSON responses**(file download, binary, CSV, Server-Sent Events streaming, etc.): after the `**media_type**:` marker, give a representative sample fragment plus a prose description of the semantics(for downloads: filename and size limit; for SSE: event names, frame format, and termination condition)
- **Non-JSON request bodies**(`multipart/form-data`, `application/x-www-form-urlencoded`, raw binary upload): after the `**media_type**:` marker, give a representative fragment(part names and sample values), then document multipart parts or form fields in the standard request field table. Use the type `file` for file parts with accepted media types, maximum size, and filename rules in the constraints column. For raw binary bodies, describe the expected content and size limit in prose
- Use simple type names: the scalars `string` / `int` / `float` / `bool` / `any`; `object`; and `file`(multipart file parts only). Arrays use recursive `T[]` notation, including nested arrays such as `int[][]`. Dynamic-key objects use recursive `map<string, T>` notation, including `map<string, string[]>`. Put formats and semantic constraints such as RFC 3339 in `Constraints / Meaning` or `Meaning`, not in `Type`. Reference notation such as `$ref` is prohibited; the only allowed body reference is the same-file `**same_as**:` line in the compact profile(§3.4)
- `**same_as**: <METHOD> <path> Request <media type>` or `**same_as**: <METHOD> <path> Response <status> <media type>`(compact profile only) declares that this entire body representation is semantically identical to an earlier representation in the same file and replaces its media marker, example/sample, field table, and representation-specific prose. Field types, required/presence rules, nullability, constraints, defaults, meanings, and wire semantics must all be identical. It must point at the full definition, never at another `**same_as**:` line. The `full` profile never uses `**same_as**:` and always duplicates
- Flatten nested objects in the table using dot notation such as `address.city`
- Flatten objects inside arrays using `[]`, such as `items[].id` and `items[].product.name`
- Use `map<string, T>` for objects with dynamic keys(OpenAPI `additionalProperties`), such as `map<string, int>`. Dynamic keys cannot be flattened with dot notation, so put the value shape in the type column and show a representative key in the example. When the value type is an object, flatten its fields with a `{key}` placeholder segment, such as `balances.{key}.amount` — `{key}` rows correspond to the representative key shown in the example(the one case where example fields match table rows by placeholder, not by literal name)
- **Tagged polymorphic fields**: list every value of the discriminator field(such as `type`) as an enum, then give each variant its own example and field table introduced by `**variant**: <field> = <value>`(for example, `**variant**: type = card`)
- **Untagged alternatives**: when alternatives have no discriminator, give each client-relevant alternative a stable prose label using `**variant**: <label>`, followed by its example and field table. Explain how the caller distinguishes alternatives. For overlapping alternatives that may be valid simultaneously, explicitly state that combination semantics and give representative combined examples; do not present them as mutually exclusive variants. If the valid set cannot be projected faithfully, use `**unsupported**:` rather than inventing a discriminator
- List all enum values in the constraints column. For large or standardized enums(ISO 4217 currency, country codes, etc.), reference the standard by name instead of enumerating every value — but only when the API accepts the standard's **full** set; if only a subset is accepted, enumerate the subset. These rules apply to the `full` profile; in the `compact` profile, the enum reductions of §3.4 take precedence
- `Required` means "cannot be omitted in a request". Omission and `null` are separate concepts
- Request field tables must include `Required` and `Nullable` columns
- For update endpoints(`PUT` / `PATCH`), mark fields that cannot be changed explicitly(an `Updatable` note in the constraints column, or `not updatable`). Also state the merge semantics of `PATCH`(for example, whether sending `null` clears the field)
- Specify default values when omitted, whether empty strings are allowed, whether empty arrays are allowed, and whether empty objects are allowed
- If a response field may be absent, specify the condition in the `Presence` column. If it may be `null`, set `Nullable` to `yes` and state the condition in `Meaning`
- **Reuse the same example values across endpoints**: the `id` returned by a create example should reappear in the matching GET/list examples(for instance `usr_01HXYZ` everywhere). Consistent fixtures let an LLM trace a value through a whole workflow

**Errors(required)**
- Write only errors specific to this endpoint(common errors belong in CONVENTIONS.md)
- Always write the "condition" and "what the caller should do", including retryability. This information lets an LLM write error handling code
- Include a concrete error response example and response field table when the shape deviates from the common error shape in CONVENTIONS.md, or when the endpoint returns field-level errors. Put `**media_type**:` before the example. Errors that follow the common shape need only their table row
- Precede every error response example with a one-line label `<status> <code>:`(for example, `422 validation_failed:`) so the example maps unambiguously to its table row
- Put endpoint-specific error response headers that the caller must read in a `#### Response Headers` table immediately after that error's example and field table
- For errors that should be displayed in forms or input UIs, include a field-level error response example
- For field-level errors, specify the target field name, machine-readable code, and whether the message can be shown to users

**Related(required)**
- Mention endpoints that are commonly called before or after this endpoint. This helps an LLM assemble the full workflow
- If a related workflow exists, link to it, such as `Workflow: workflows/checkout.md`

**Deviations from CONVENTIONS.md**
- Write a deviation inside the section it affects, prefixed with the fixed marker `**deviation**:`(for example, `**deviation**: this list API uses offset pagination instead of cursors`). The fixed marker lets an LLM find every deviation in a file

## 5. Workflow Definitions (workflows/, optional)

Operations that require multiple endpoints to be called in a specific order should be written as workflows.

```markdown
> docai-http: 1.0.0 | profile: full | generated: 2026-06-30 | generation_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_sha: abc123

# Checkout

Procedure until order confirmation.

## Preconditions

- The cart exists and contains at least one item

## Steps

1. POST /carts/{id}/validate — Check inventory. If 409 occurs, adjust quantities and retry
2. POST /payments — Pass `cart_id`. Keep the returned `payment_id`
3. POST /orders — Pass `payment_id`. Inventory is reserved only at this step

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.validated | POST /payments succeeds | payment.pending |
| payment.pending | POST /orders succeeds | order.confirmed |

## Failure and Recovery

- If more than 15 minutes pass between steps 2 and 3, the payment expires and POST /orders returns 410. Restart from step 2
```

- Use the fixed headings `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery` in that order. Write `none` when a section does not apply.
- Use a numbered list to express order. For each step, write "values passed to the next step" and "failure branches".
- State-transition tables use `From | Endpoint / Event | To`. Include every transition relevant to completing or recovering the workflow.
- Workflow files must be discoverable from the `Workflows` section in INDEX.md.
- Related endpoints must also reference the workflow from their `Related` section.

## 6. Webhook Definitions (webhooks/, optional)

Webhooks are calls in the reverse direction: the API sends an HTTP request to a URL registered by the client. They may originate from an OpenAPI top-level `webhooks` field or another source and are documented apart from resources — one file per event(or per group of closely related events). DocAI HTTP is not tied to one OpenAPI version; a generator must identify its exact input in `source` and mark client-relevant input features it cannot project with `**unsupported**:`.

````markdown
> docai-http: 1.0.0 | profile: full | generated: 2026-06-30 | generation_id: 20260630-abc123 | source: openapi.yaml (OpenAPI 3.1.1) | source_sha: abc123

# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

**deviation**: delivery of this event is retried for up to 24 hours, not the default 5 attempts

## Headers

none

## Payload

**media_type**: application/json

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
| event_id | string | always | no | Unique event identifier. Deduplicate repeated delivery attempts by this field |
| event | string | always | no | Always `payment.completed` |
| payment_id | string | always | no | ULID with `pay_` prefix. Matches the id returned by POST /payments |
| amount | int | always | no | Settled amount in JPY |
| occurred_at | string | always | no | RFC 3339 timestamp for when the payment settled |

## Related

- Triggered by: asynchronous settlement after POST /payments
````

- Use the fixed headings `Headers`, `Payload`, and `Related` in that order. Write `none` when a section does not apply.
- Event-specific request headers use `Name | Required | Type | Constraints / Meaning`. API-wide signature headers remain in `CONVENTIONS.md`.
- Write each payload representation with the same media-type, example-first, and field-table rules as responses.
- Delivery conventions shared by all webhooks — signature verification, sender identification, what the receiver must return(status code, response deadline), retry policy(count, interval, when delivery is abandoned), and delivery guarantees(at-least-once or at-most-once, ordering) — belong in CONVENTIONS.md(§3.3) and are **not repeated per event**.
- A webhook file documents only event-specific deviations from those conventions, prefixed with `**deviation**:` and placed directly after the intro description(see the template).
- Name a unique event or delivery identifier in the payload table's meaning column. Do not use a resource identifier for deduplication when multiple legitimate events can refer to that resource. If no single identifier exists, state the exact composite deduplication strategy.
- Webhook files must be discoverable from the `Webhooks` section in INDEX.md, and endpoints that trigger a webhook must mention it in their `Related` section.

## 7. Writing Style Rules

The per-section rules in §4.1 are normative — this section only adds cross-cutting style guidance and does not restate them.

- Keep each file to a measured token budget that loads comfortably in the target model together with the expected code context. Do not use line count as the normative split criterion. Split a large resource into task-oriented resource shards before it exceeds that budget.
- Prefer tables, lists, and code blocks over prose.
- Avoid verbose expressions. Write directly and decisively.
- Explicitly state negative facts, such as "this field cannot be updated" or "this API does not paginate". LLMs fill in missing information by guessing, so clearly stating what is not possible prevents hallucination.
- Put metadata information(DocAI HTTP format version, profile, generation date, generation ID, source, and source revision when available) at the beginning of **every file**, not only INDEX.md(see §3) — files are loaded individually.
- Do not omit information that affects frontend implementation. Examples: screen transition after authentication failure, retry display, mapping errors to form fields, download file name, upload size limit.
- Distinguish messages that may be used directly as UI copy from messages intended for logs or developers.
- Write each generated DocAI HTTP document set in a **single prose language**. Generated DocAI HTTP must not repeat the same content in multiple languages — choose one output language and use it consistently across INDEX.md, CONVENTIONS.md, and all resource, workflow, and webhook files. Structural text(headings, table column headers, canonical keys, markers, fixed values) is always English(§4.1); the document language applies to prose only.
- Generate `**call_shape**:` only for files where measured navigation savings justify its duplicated facts.
- Before fixing generator defaults, benchmark representative tasks using both duplication and references. Compare total loaded tokens and correct-call rate for the target models; DocAI HTTP does not assume one strategy is universally cheaper.
- When a compact set exists, load it first and retrieve full-profile detail only for the selected operation. Do not place both complete sets in context by default.

## 8. Relationship with OpenAPI

- **Conversion is one-directional: source → DocAI HTTP.** DocAI HTTP is a generated artifact. The authoritative source(OpenAPI document, code, etc.) is the **maintenance source of truth**; DocAI HTTP is the client-implementation projection the LLM reads. Edit the source and regenerate DocAI HTTP — never the other way around.
- DocAI HTTP is not a lossless OpenAPI or JSON Schema representation and is not tied to one OpenAPI version. The `full` profile must preserve every source fact needed to call the API correctly that DocAI HTTP can represent. It must mark an unrepresentable client-relevant feature with `**unsupported**:` and direct the reader to its source location.
- The `compact` profile may intentionally reduce detail only under §3.4 and must point to the full set when both exist.
- DocAI HTTP does not replace OpenAPI. They coexist: OpenAPI or another authoritative source continues to serve validation, generation, and complete schema semantics; DocAI HTTP serves efficient LLM context.

## 9. Compliance Checklist

A document set is DocAI HTTP-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist
- [ ] The `docai-http` value uses `major.minor.patch`; no unknown non-`x-` structural text is present(§3.1)
- [ ] Every file(INDEX.md, CONVENTIONS.md, resources/, workflows/, webhooks/) begins with a metadata stamp containing `docai-http` / `profile` / `generated` / `generation_id` / `source`, and `source_sha` when available
- [ ] All files in one profile set share the same `profile`, `generated`, and `generation_id`; when both profiles exist, each INDEX.md links the other set's root(§3.4)
- [ ] INDEX.md includes `Endpoints`, `Workflows`, and `Webhooks` in order; it groups endpoints into one `###` subsection per resource file and fills `Task`, `Summary`, and `Also read` for every endpoint, or writes `none` for an empty section(§3.2)
- [ ] CONVENTIONS.md uses every fixed heading in §3.3 in order; its common and validation error shapes include examples and field tables
- [ ] The set is written in a single prose language, and all structural text is English(§4.1, §7)
- [ ] Every endpoint follows the fixed section structure and order; each endpoint appears in exactly one bounded resource file
- [ ] Requests are split in order into path parameters, query parameters, headers, cookie parameters, and body; only leading `none` parts are collapsed into one-line list items
- [ ] Array and object parameters state their exact wire serialization with an encoded example
- [ ] Every non-empty request, successful response, endpoint-specific error body, and webhook payload representation starts with `**media_type**:` and has a concrete example; structured content has the required field table, while raw binary and unstructured streams follow the sample-and-prose exception; compact bodies may instead use a valid `**same_as**:` reference
- [ ] Body-less requests and responses explicitly say `none`; multiple media types and response status ranges preserve the caller-visible selection or branching behavior
- [ ] Response headers the caller must read are documented(or `none`)
- [ ] Response, endpoint-specific error, and webhook payload field tables specify presence and nullability, except compact `Opaque fields` documented only for store/forward behavior
- [ ] Every example field, including object and array containers, has a corresponding field-table row
- [ ] Types use the defined recursive grammar; formats such as RFC 3339 are written in the constraints or meaning column
- [ ] No cross-file schema reference notation such as `$ref` is used; `**same_as**:` appears only in the compact profile as a direct backward reference to a semantically identical representation in the same file
- [ ] Array, nesting, `null`, omission, empty-value, and default-value behavior are specified
- [ ] Tagged alternatives enumerate discriminator values and use `**variant**: <field> = <value>`; untagged or overlapping alternatives follow the explicit rules in §4.1
- [ ] Client-relevant source features that cannot be projected faithfully are marked with `**unsupported**:` and a source location
- [ ] For update endpoints, non-updatable fields and `PATCH` merge semantics are specified
- [ ] Every error includes its condition, caller action, and retryability; field-level errors identify the target, machine code, and UI-display policy
- [ ] The `Behavior` section uses `side_effects` / `idempotency` / `preconditions` / `authorization` in order(write `none` when none apply)
- [ ] Deviations from CONVENTIONS.md are marked with `**deviation**:` in the affected section
- [ ] Deprecated endpoints have a `**deprecated**:` line after the heading and `(deprecated)` in their INDEX.md summary
- [ ] Workflow files use every fixed heading in §5, are referenced from INDEX.md and related endpoints, and document values passed, failure branches, recovery, and relevant state transitions
- [ ] Webhook files use every fixed heading in §6, are listed in INDEX.md, identify a safe deduplication key or strategy, and are referenced by triggering endpoints
