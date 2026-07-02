# docai — API Documentation Format for AI/LLM

docai is a documentation format for describing backend APIs in a way that is optimized for AI/LLM consumption.
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

docai is a documentation format for describing backend APIs in a way that is optimized for **LLMs to understand and use**. OpenAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, docai has one purpose: **allow an LLM to load the documentation into context and write correct API-calling code on the first attempt**.

docai is designed to be **generated from a single source** (an OpenAPI document, code annotations, or similar), not hand-maintained. The format deliberately duplicates information for the LLM's benefit (see Core Principles), and that duplication is only safe to maintain when a generator produces it from one authoritative source. **Hand-editing the duplicated parts of a generated docai is discouraged**, because edits will drift between copies. This discouragement applies only to the duplicated parts(resource files): `CONVENTIONS.md` and `workflows/` typically contain knowledge absent from the machine-readable source, so they may be hand-maintained — or maintained as inputs the generator passes through(the generator still stamps them).

This document defines only the **format rules**. It does not cover tools or generator implementations.

### Why docai is needed instead of only OpenAPI

OpenAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` — understanding one endpoint requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- There is no natural place to write side effects, call order, or business rules

docai reverses these tradeoffs: **no cross-file schema/object references, flat structure, required examples for non-empty bodies, and required behavior descriptions**. Cross-file links are allowed only for navigation and context selection, such as `CONVENTIONS.md`, `Also read`, workflows, and webhooks.

## 2. Core Principles

1. **Self-contained with conventions** — An endpoint definition must be fully understandable when read together with `CONVENTIONS.md`. The normal read order is `INDEX.md` → `CONVENTIONS.md` → the selected resource/workflow/webhook file. Even common schemas and shared domain objects(such as `User`, `Money`, `Address`) must be expanded inline in each endpoint; within a single file, the `compact` profile may replace repeated identical body shapes with a `**same_as**:` back-reference(§3.3). Duplication is acceptable. For LLMs, duplication has a cost, but reference resolution is more expensive. Consistency across the duplicated copies is the **generator's responsibility**(§1); keeping them in sync by hand is discouraged. The only thing factored out of endpoints is API-wide conventions, which live in CONVENTIONS.md(§3.2) — shared *objects* are not conventions and are still inlined.
2. **Example-first** — Every non-empty request body and response body must include realistic concrete examples. Schemas exist to supplement examples. Body-less requests/responses must explicitly say `none`; in the `compact` profile, a request or response body may use `**same_as**:` instead of repeating an identical earlier example.
3. **Markdown-based** — Structured Markdown and fenced code blocks are the most stable format for LLM interpretation. docai must not be a YAML/JSON-only definition file.
4. **Deterministic structure** — Section order, heading levels, and required section roles are fixed. All structural text — fixed headings, table column headers, canonical keys, markers, and fixed values — is written in English regardless of the document language(§4.1); only prose is written in the document language. An LLM should be able to predict where information exists just from knowing the docai format.
5. **Describe behavior** — Side effects, idempotency, preconditions, error-time state, and other information that cannot be inferred from signatures must be required.
6. **One file per resource** — Split files so that only the context needed for the task has to be loaded.

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
    payment-completed.md  # Optional: webhooks the API sends (OpenAPI 3.1 `webhooks`)
```

Because files are loaded **individually**(that is the point of splitting), freshness cannot live only in INDEX.md. Every file — INDEX.md, CONVENTIONS.md, and each file under resources/, workflows/, and webhooks/ — must begin with a one-line metadata stamp so an LLM that loaded only that file can judge how current it is and how much detail it contains:

```markdown
> docai: 1 | profile: full | generated: 2026-06-30 | source: openapi.yaml | source_sha: abc123
```

- `docai` is the docai format version.
- `profile` is either `full` or `compact`(§3.3).
- `generated` is the generation date.
- `source` is the source document(s) or source system(s) used to generate the file.
- `source_sha` is the stable revision or content hash covering the input(s) used to generate that file, including pass-through inputs such as hand-maintained `CONVENTIONS.md` or workflow content when they are stamped by the generator. Omit it only when no stable revision can be produced.

A document set is always regenerated **as a whole**: one generation run re-stamps every file in the set with the same `generated` date(`source` and `source_sha` may differ per file when files have different inputs). If `generated` differs between files of one set, the set has been partially regenerated and must not be treated as consistent.

### 3.1 INDEX.md(required)

The entry point that an LLM reads first. Endpoints are listed under a fixed `## Endpoints` section, grouped into **one subsection per resource file**: a `###` heading whose text is the file's path from the docs root, followed by a table with one endpoint per row.

```markdown
> docai: 1 | profile: full | generated: 2026-06-30 | source: openapi.yaml | source_sha: abc123

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
- `Task` is a short client intent label, usually 1-3 words, that helps an LLM avoid loading unrelated resource files. Reuse the exact same label for every endpoint that serves the same client task(for example, all checkout endpoints use `checkout`); endpoints serving different tasks get different labels(`create user`, `read user`). Do not invent synonyms for one task.
- `Summary` must add information beyond `Task`(key behavior, side effect, or distinguishing detail) — do not restate the task label. Keep each summary within 80 UTF-8 bytes. The limit is a language-neutral hard cap(about 80 ASCII characters or 26 Japanese characters); token counts vary by model and language, so treat any token estimate as only a rough guide.
- `Also read` lists extra files that should usually be loaded for this endpoint, such as workflows. Write `none` when no extra file is normally needed.
- If files exist under workflows/, list them in the `Workflows` section.
- If files exist under webhooks/, list them in the `Webhooks` section.

### 3.2 CONVENTIONS.md(required)

Write API-wide conventions in **one place only**. This is the only exception that allows repetition to be removed from endpoint definitions. Required items:

- Base URLs and environments
- API versioning convention(path, header, or another method)
- Authentication method(header name, how to obtain a token, concrete examples)
- Authentication state handling(redirect on 401, token refresh, logout, `credentials` setting when using cookies)
- CORS, Cookie, and CSRF conventions
- Request formats(JSON, multipart/form-data, application/x-www-form-urlencoded, etc.)
- Common error response shape(401/403/429/500 and other errors shared by all endpoints)
- Validation error shape(field-level error representation, messages used for screen display)
- Pagination convention
- List API sorting, filtering, and search conventions
- Representation rules for datetime, IDs, money, etc.(for example, "all datetimes are RFC 3339 / UTC")
- Handling of `null`, empty arrays, empty objects, empty strings, and omitted fields
- File upload and file download conventions
- Rate limits
- Webhook delivery conventions, when the API sends webhooks: signature verification, sender identification, what the receiver must return(status code, response deadline), retry policy(count, interval, when delivery is abandoned), and delivery guarantees(at-least-once or at-most-once, ordering)

Each endpoint definition, webhook file, and workflow file implicitly follows `CONVENTIONS.md`. Only deviations must be described in the file itself, inside the section they affect and prefixed with the fixed marker `**deviation**:`(§4.1) so an LLM can locate them. In a webhook file, deviations from the delivery conventions are placed directly after the intro description(§6).

### 3.3 Output Profiles

docai supports two generated profiles. Both profiles must be generated from the same source of truth.

- `full` — the canonical reference profile. It preserves all request/response fields and behavior needed to match the source schema and is the default generation profile.
- `compact` — the LLM runtime profile. It reduces token usage while preserving enough information to call the API correctly for frontend or client implementation.

A document set is generated per profile: every file in a set carries the same `profile` value in its stamp. When both profiles are generated, they live in separate roots(for example, the full set in `docs/` and the compact set in `docs-compact/`). An LLM implementing a client should load the compact set when it exists and consult the full set only for detail compact omits. When both profiles are generated, each set's INDEX.md must state the other set's root on one line directly under the metadata stamp, using the fixed labels `Full set:` / `Compact set:`(for example, `Compact set: ../docs-compact/` in the full set), so an LLM that loaded one set can discover the other.

The `compact` profile may apply these reductions:

- Split large response field tables into two tables under the fixed `####` headings `Frontend-visible fields` and `Opaque fields`, in that order(both are canonical tokens, §4.1). `Frontend-visible fields` are documented normally. `Opaque fields` may be summarized by name, type, and one short meaning when the client normally stores or forwards them without inspecting their internals.
- For opaque nested objects that the client stores or forwards without inspecting, document only the root field in `Opaque fields` as `object` or `object[]` with a short meaning such as `store/forward only`. Do not flatten opaque leaf fields unless client logic reads them.
- Use minimal valid request examples. Include only required fields and optional fields that materially affect the call.
- Use representative response examples. Include common frontend-visible fields and omit rarely used optional fields unless they affect client logic.
- For very large enums, standardized enums, or enums irrelevant to client branching, reference the standard or category instead of listing every value. If the client branches on only a small subset, list the branching values explicitly and state how all other values should be handled.
- Use short `none` lines such as `- Path Parameters: none`, `- Query Parameters: none`, and `- Body: none` as long as the fixed request order is preserved.
- Within one resource file, when a later request or response body is shape-identical to an earlier body in the same file, replace its example and field table with a single `**same_as**:` line(§4.1). Backward references only — the full definition must appear at its first occurrence.

The `compact` profile must not omit information that changes how a caller constructs requests, handles errors, follows workflows, authenticates, retries, paginates, uploads/downloads files, or interprets state transitions.

## 4. Endpoint Definition Format

In a resource file, define each endpoint using the following template. **Section order, heading levels, and section roles are fixed**. Headings and all other structural text are fixed English tokens(§4.1); only prose is written in the document language. Do not omit sections that do not apply. Write `none` instead so that an LLM can distinguish "intentionally none" from "forgotten". Request subsections whose entire content is `none` may be collapsed into one-line list items(§4.1).

````markdown
## POST /users

Creates a user. Email addresses are globally unique across all tenants.

**call_shape**: POST /users creates a User; requires `users:write`; may return 409 `email_taken` or 422 `validation_failed`

### Behavior

- side_effects: On successful creation, a confirmation email is sent asynchronously
- idempotency: not idempotent. Send an `Idempotency-Key` header from the first attempt when the call may be retried
- preconditions: caller must have the admin role
- authorization: `users:write` scope

### Request

- Path Parameters: none
- Query Parameters: none

#### Headers

| Name | Required | Type | Constraints / Meaning |
|---|---|---|---|
| Idempotency-Key | no | string | Send from the first attempt when the call may be retried, and reuse the same key on retries. A repeated key returns the first result instead of re-executing |

#### Body

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
| created_at | string (RFC 3339) | always | no | Creation timestamp |

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

### Related

- Fetch after creation: GET /users/{id}
- List: GET /users
- Workflow: workflows/user-onboarding.md
````

### 4.1 Section Rules

**Heading(`## METHOD /path`)**
- Use the method and path directly as the heading. Path parameters use `{id}` format.
- Immediately after the heading, write 1-2 sentences describing why this endpoint is called. Describe the purpose, not the implementation.
- After the purpose description, a generated file may include one optional `**call_shape**:` line that summarizes how the client calls the endpoint and the most important implementation consequences(auth, returned resource, important endpoint-specific errors, or async/pagination behavior). It should fit on one line. Its role is **in-file navigation**: in a long resource file, an LLM can scan only the `**call_shape**:` lines to find the endpoint it needs before reading it in full. That navigation value is why it is recommended in the `compact` profile even though it repeats facts stated in `Behavior` and `Errors`.
- If the endpoint is deprecated, put a `**deprecated**: <replacement endpoint and migration>` line immediately after the heading, before the description, and prefix its INDEX.md summary with `(deprecated)`. Omit the line entirely otherwise — there is no permanent `deprecated` label.

**Behavior(required)**
- Use these **four canonical keys in this order** so an LLM and validation tools can always locate each fact: `side_effects`, `idempotency`, `preconditions`, `authorization`. Write `none` for any that do not apply
- All structural text is always written in English, even when generated prose is written in another language. Structural text is: every fixed heading this format defines(`API Index`, `Endpoints`, `Workflows`, `Webhooks`, `Behavior`, `Request`, `Path Parameters`, `Query Parameters`, `Headers`, `Body`, `Response <status>`, `Response Headers`, `Errors`, `Related`, `Payload`, `Frontend-visible fields`, `Opaque fields`); every table column header(`Method` / `Path` / `Task` / `Summary` / `Details` / `Also read` / `Name` / `Field` / `Type` / `Required` / `Nullable` / `Presence` / `Constraints / Meaning` / `Meaning` / `Status` / `code` / `Condition` / `What the caller should do`); the Behavior keys `side_effects` / `idempotency` / `preconditions` / `authorization`; the markers `**call_shape**:`, `**deprecated**:`, `**deviation**:`, `**same_as**:`, and `**variant**:`; the `(deprecated)` summary prefix and the profile cross-link labels `Full set:` / `Compact set:`(§3.3); the fixed values `none` / `yes` / `no` / `always` / `full` / `compact` and the simple type names; and the metadata stamp keys `docai` / `profile` / `generated` / `source` / `source_sha`. Only prose — descriptions, summaries, and free-text cells such as conditions, constraints, and meanings — is written in the document language(§7)
- `side_effects`: list all(email sending, changes to other resources, event publishing, etc.)
- `idempotency`: state whether the endpoint is idempotent and whether it can be retried safely
- `preconditions`: earlier APIs that must be called, required resource state, etc.
- `authorization`: required scope/role(may overlap with `preconditions`; keep auth here)
- These are the pieces of information that OpenAPI has no natural place for and that LLMs are most likely to get wrong

**Request / Response**
- Put the **concrete example(JSON code block) first, then the field table** for every non-empty request body, JSON response body, and webhook payload
- Use realistic example values(`"taro@example.com"` instead of `"string"` or `"foo"`)
- In the `full` profile, request examples should be representative valid examples and response examples should show the normal complete shape. In the `compact` profile, request examples should be minimal valid examples, and response examples should be representative examples focused on fields that affect client implementation
- Every field in the example must have a corresponding row in the field table
- In the `full` profile, field tables must document every field in the source schema, even when a rarely used optional field is absent from the example. In the `compact` profile, field tables may be broader than the representative example, but they must not omit fields that affect client implementation
- Write requests in this order: `Path Parameters`, `Query Parameters`, `Headers`, `Body`. If a part does not apply, write `none`
- Request subsections whose entire content is `none` may drop the `####` heading and be written as one-line list items directly under `### Request`, keeping the fixed order(see the template). Subsections with content keep their `####` heading: `#### Path Parameters`, `#### Query Parameters`, `#### Headers`, and `#### Body`. `#### Response Headers` may likewise be collapsed to a one-line `- Response Headers: none`
- Path parameter tables use the columns `Name | Type | Constraints / Meaning`. There is no `Required` column — path parameters are always required
- Query parameter tables use the columns `Name | Type | Required | Constraints / Meaning`, with defaults in the constraints column:

  ```markdown
  | Name | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | page | int | no | 1-based. Defaults to `1` |
  ```

- If there is no response body, write `none`
- Add a `#### Response Headers` table when the caller must read response headers(`Location`, `Set-Cookie`, `Retry-After`, `ETag`, `Link`, etc.). Write `none` when there are none. Document it per status code when it differs(for example, `Retry-After` only on 429)
- Request header tables use the columns `Name | Required | Type | Constraints / Meaning`. Response header tables use the columns `Name | Type | Meaning`. Header values are strings unless another syntax is stated explicitly in the `Type` or meaning/constraints column
- Response and webhook payload field tables normally use the columns `Field | Type | Presence | Nullable | Meaning`. `Presence` describes whether the field is `always` present or the condition under which it is omitted. In compact `Opaque fields` tables, `Field | Type | Meaning` is allowed for fields whose internals the client does not inspect
- If there are multiple successful responses, split them by status code, such as `### Response 200`, `### Response 202`, and `### Response 204`
- For asynchronous acceptance such as `202 Accepted`, describe the endpoint used to check completion, polling interval, timeout, and failure-time state
- **Redirect responses(3xx)**: document them as `### Response 302`(etc.) with a `#### Response Headers` table containing `Location`, and state whether the client follows the redirect automatically(the `fetch` default) or must read `Location` and act manually(for example, signed download URLs)
- **Non-JSON responses**(file download, binary, CSV, Server-Sent Events streaming, etc.): state the `Content-Type` explicitly, and instead of a JSON block give a representative sample fragment plus a prose description of the semantics(for downloads: filename, size limit; for SSE: event names, frame format, terminate condition)
- **Non-JSON request bodies**(`multipart/form-data`, `application/x-www-form-urlencoded`, raw binary upload): state the `Content-Type` explicitly at the top of `#### Body`. For multipart and form-urlencoded bodies, keep the example-first rule — give a representative fragment(part names and sample values) instead of a JSON block, then document the parts/fields in the standard request field table, using the type `file` for file parts with accepted media types, maximum size, and filename rules in the constraints column. For raw binary bodies, describe the expected content and size limit in prose
- Use simple type names: `string` / `int` / `float` / `bool` / `string[]` / `object` / `object[]` / `map<string, T>` / `file`(multipart file parts only). Reference notation such as `$ref` is prohibited; the only allowed reference is the same-file `**same_as**:` line in the compact profile(§3.3)
- `**same_as**: <METHOD> <path> Request` or `**same_as**: <METHOD> <path> Response <status>`(compact profile only) declares that this request or response body is identical to an earlier body in the same file, and replaces the JSON example and field table. Use it only for identical shapes — if any field differs, write the full example and table. It must point at the full definition, never at another `**same_as**:` line. The `full` profile never uses `**same_as**:` and always duplicates
- Flatten nested objects in the table using dot notation such as `address.city`
- Flatten objects inside arrays using `[]`, such as `items[].id` and `items[].product.name`
- Use `map<string, T>` for objects with dynamic keys(OpenAPI `additionalProperties`), such as `map<string, int>`. Dynamic keys cannot be flattened with dot notation, so put the value shape in the type column and show a representative key in the example. When the value type is an object, flatten its fields with a `{key}` placeholder segment, such as `balances.{key}.amount` — `{key}` rows correspond to the representative key shown in the example(the one case where example fields match table rows by placeholder, not by literal name)
- **Polymorphic fields(OpenAPI `oneOf` / `anyOf`)**: list every value of the discriminator field(such as `type`) as an enum in the table, then give each variant its own JSON example and its own field table, introduced by the fixed one-line label `**variant**: <field> = <value>`(for example, `**variant**: type = card`) so variants can be located deterministically. Schema-composition notation must not be used, just like `$ref`
- List all enum values in the constraints column. For large or standardized enums(ISO 4217 currency, country codes, etc.), reference the standard by name instead of enumerating every value — but only when the API accepts the standard's **full** set; if only a subset is accepted, enumerate the subset. These rules apply to the `full` profile; in the `compact` profile, the enum reductions of §3.3 take precedence
- `Required` means "cannot be omitted in a request". Omission and `null` are separate concepts
- Request field tables must include `Required` and `Nullable` columns
- For update endpoints(`PUT` / `PATCH`), mark fields that cannot be changed explicitly(an `Updatable` note in the constraints column, or `not updatable`). Also state the merge semantics of `PATCH`(for example, whether sending `null` clears the field)
- Specify default values when omitted, whether empty strings are allowed, whether empty arrays are allowed, and whether empty objects are allowed
- If a response field may be absent, specify the condition in the `Presence` column. If it may be `null`, set `Nullable` to `yes` and state the condition in `Meaning`
- **Reuse the same example values across endpoints**: the `id` returned by a create example should reappear in the matching GET/list examples(for instance `usr_01HXYZ` everywhere). Consistent fixtures let an LLM trace a value through a whole workflow

**Errors(required)**
- Write only errors specific to this endpoint(common errors belong in CONVENTIONS.md)
- Always write the "condition" and "what the caller should do", including retryability. This information lets an LLM write error handling code
- Include a concrete error response example when the shape deviates from the common error shape in CONVENTIONS.md, or when the endpoint returns field-level errors. Errors that follow the common shape need only their table row
- Precede every error response example with a one-line label `<status> <code>:`(for example, `422 validation_failed:`) so the example maps unambiguously to its table row
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
> docai: 1 | profile: full | generated: 2026-06-30 | source: openapi.yaml | source_sha: abc123

# Checkout

Procedure until order confirmation.

1. POST /carts/{id}/validate — Check inventory. If 409 occurs, adjust quantities and retry
2. POST /payments — Pass `cart_id`. Keep the returned `payment_id`
3. POST /orders — Pass `payment_id`. Inventory is reserved only at this step

Note: If more than 15 minutes pass between steps 2 and 3, the payment expires(410 is returned).
```

- Use a numbered list to express order. For each step, write "values passed to the next step" and "failure branches".
- If there are state transitions(for example, order status), write a table listing possible states and the endpoints that cause transitions.
- Workflow files must be discoverable from the `Workflows` section in INDEX.md.
- Related endpoints must also reference the workflow from their `Related` section.

## 6. Webhook Definitions (webhooks/, optional)

Webhooks are calls in the reverse direction: the API sends an HTTP request to a URL registered by the client. They correspond to the top-level `webhooks` field in OpenAPI 3.1 and are documented apart from resources — one file per event(or per group of closely related events).

````markdown
> docai: 1 | profile: full | generated: 2026-06-30 | source: openapi.yaml | source_sha: abc123

# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

**deviation**: delivery of this event is retried for up to 24 hours, not the default 5 attempts

## Payload

```json
{
  "event": "payment.completed",
  "payment_id": "pay_01HXYZ",
  "amount": 1200,
  "occurred_at": "2026-06-11T09:31:00Z"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| event | string | always | no | Always `payment.completed` |
| payment_id | string | always | no | ULID with `pay_` prefix. Matches the id returned by POST /payments. Deduplicate deliveries by this field |
| amount | int | always | no | Settled amount in JPY |
| occurred_at | string (RFC 3339) | always | no | When the payment settled |
````

- Write the payload with the same example-first rule as responses: JSON example first, then the field table.
- Delivery conventions shared by all webhooks — signature verification, sender identification, what the receiver must return(status code, response deadline), retry policy(count, interval, when delivery is abandoned), and delivery guarantees(at-least-once or at-most-once, ordering) — belong in CONVENTIONS.md(§3.2) and are **not repeated per event**.
- A webhook file documents only event-specific deviations from those conventions, prefixed with `**deviation**:` and placed directly after the intro description(see the template).
- Name the field to deduplicate deliveries by in the payload table's meaning column — it is event-specific.
- Webhook files must be discoverable from the `Webhooks` section in INDEX.md, and endpoints that trigger a webhook must mention it in their `Related` section.

## 7. Writing Style Rules

The per-section rules in §4.1 are normative — this section only adds cross-cutting style guidance and does not restate them.

- Keep each file to a size that loads comfortably as context. As a rough guide, split a resource once it grows past roughly 1,000 lines; tables are token-dense, so judge by tokens rather than line count when in doubt.
- Prefer tables, lists, and code blocks over prose.
- Avoid verbose expressions. Write directly and decisively.
- Explicitly state negative facts, such as "this field cannot be updated" or "this API does not paginate". LLMs fill in missing information by guessing, so clearly stating what is not possible prevents hallucination.
- Put metadata information(docai format version, profile, generation date, source, and source revision when available) at the beginning of **every file**, not only INDEX.md(see §3) — files are loaded individually.
- Do not omit information that affects frontend implementation. Examples: screen transition after authentication failure, retry display, mapping errors to form fields, download file name, upload size limit.
- Distinguish messages that may be used directly as UI copy from messages intended for logs or developers.
- Write each generated docai document set in a **single prose language**. Generated docai must not repeat the same content in multiple languages — choose one output language and use it consistently across INDEX.md, CONVENTIONS.md, and all resource, workflow, and webhook files. Structural text(headings, table column headers, canonical keys, markers, fixed values) is always English(§4.1); the document language applies to prose only.

## 8. Relationship with OpenAPI

- **Conversion is one-directional: source → docai.** docai is a generated artifact. The authoritative source (OpenAPI document, code, etc.) is the **maintenance source of truth**; docai is the **reference the LLM reads**. Edit the source and regenerate docai — never the other way around.
- Because the source may be OpenAPI, the `full` profile's field tables must carry at least as much information as the OpenAPI schema, so generation loses nothing. The `compact` profile may intentionally reduce detail only under the rules in §3.3.
- docai does not replace OpenAPI. They coexist: OpenAPI continues to serve code generation, validation, and human browsing; docai serves LLM consumption.

## 9. Compliance Checklist

A document is docai-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist
- [ ] Every file(INDEX.md, CONVENTIONS.md, resources/, workflows/, webhooks/) begins with a metadata stamp(`docai` / `profile` / `generated` / `source`, and `source_sha` when available)
- [ ] All files in the set share the same `generated` date(sets are regenerated as a whole, §3), and when both profiles exist each INDEX.md links the other set's root(§3.3)
- [ ] INDEX.md groups endpoints into one `###` subsection per resource file under `## Endpoints`(§3.1), and fills `Task` and `Also read` for every endpoint; summaries stay within 80 UTF-8 bytes
- [ ] The set is written in a single prose language, and all structural text is English(§4.1, §7)
- [ ] Every endpoint follows the fixed template section structure and order
- [ ] Every non-empty request body and response body has a concrete example(in `compact`, a request or response body may instead carry a `**same_as**:` reference); body-less requests/responses explicitly say `none`; errors include an example when §4.1 requires it(shape deviates from CONVENTIONS.md, or field-level errors)
- [ ] Requests are split into path parameters, query parameters, headers, and body(all-`none` parts may be one-line list items)
- [ ] Successful responses are documented by status code, and body-less responses explicitly say `none`
- [ ] Response headers the caller must read are documented(or `none`); non-JSON responses state their `Content-Type`
- [ ] Response and webhook payload field tables specify presence and nullability, except compact `Opaque fields` that are documented only for store/forward behavior
- [ ] No cross-file reference notation such as `$ref` is used; `**same_as**:` appears only in the `compact` profile, only as a backward reference within the same file
- [ ] Array, nesting, `null`, omission, and default-value behavior are specified
- [ ] For update endpoints, non-updatable fields and `PATCH` merge semantics are specified
- [ ] Every error includes the condition and what the caller should do
- [ ] Validation errors include a field-level error example
- [ ] The `Behavior` section uses the canonical keys `side_effects` / `idempotency` / `preconditions` / `authorization`(write `none` when none apply)
- [ ] Deviations from CONVENTIONS.md are marked with `**deviation**:` in the affected section
- [ ] Deprecated endpoints have a `**deprecated**:` line after the heading and `(deprecated)` in their INDEX.md summary
- [ ] Files under workflows/ are referenced from INDEX.md and from related endpoints; workflows with state transitions include a state-transition table(§5)
- [ ] Files under webhooks/ are listed in the `Webhooks` section of INDEX.md, endpoints that trigger a webhook reference it in their `Related` section, and webhook files state delivery behavior only as `**deviation**:` lines from CONVENTIONS.md(§6)
