# docai — API Documentation Format for AI/LLM

docai is a documentation format for describing backend APIs in a way that is optimized for AI/LLM consumption.
It is designed so that an AI can read the API documentation as context and efficiently implement a web frontend that calls the API correctly.

> **日本語の説明は英語の説明の後に記載されています。** [→ 日本語版へジャンプ](#docai日本語)
> *Japanese documentation follows the English documentation below.*

This README is intentionally bilingual (English / Japanese) because it is a **specification written for human readers**, who may prefer either language. If the English and Japanese texts disagree, the **English text is normative**. That duplication applies only to this document. It is **not** a docai rule: a generated docai document is written in a **single language** and never repeats the same content across multiple languages (see §7).

このREADMEは **人間の読者向けの仕様書** であり、読者がどちらの言語でも読めるよう、意図的に英語・日本語の二言語で記述している。英語と日本語の記述が食い違う場合は **英語版を正** とする。この重複は本書のみに適用される。これは docai のルールではない: 生成される docai ドキュメントは **単一言語** で記述され、同じ内容を複数言語で繰り返すことはない(第7節を参照)。

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
- [docai(日本語)](#docai日本語)

---

## 1. Overview

docai is a documentation format for describing backend APIs in a way that is optimized for **LLMs to understand and use**. OpenAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, docai has one purpose: **allow an LLM to load the documentation into context and write correct API-calling code on the first attempt**.

docai is designed to be **generated from a single source** (an OpenAPI document, code annotations, or similar), not hand-maintained. The format deliberately duplicates information for the LLM's benefit (see Core Principles), and that duplication is only safe to maintain when a generator produces it from one authoritative source. **Hand-editing the duplicated parts of a generated docai is discouraged**, because edits will drift between copies.

This document defines only the **format rules**. It does not cover tools or generator implementations.

### Why docai is needed instead of only OpenAPI

OpenAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` — understanding one endpoint requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- There is no natural place to write side effects, call order, or business rules

docai reverses these tradeoffs: **no references, flat structure, required examples, and required behavior descriptions**.

## 2. Core Principles

1. **Self-contained with conventions** — An endpoint definition must be fully understandable when read together with `CONVENTIONS.md`. The normal read order is `INDEX.md` → `CONVENTIONS.md` → the selected resource/workflow/webhook file. Even common schemas and shared domain objects(such as `User`, `Money`, `Address`) must be expanded inline in each endpoint. Duplication is acceptable. For LLMs, duplication has a cost, but reference resolution is more expensive. Consistency across the duplicated copies is the **generator's responsibility**(§1); keeping them in sync by hand is discouraged. The only thing factored out of endpoints is API-wide conventions, which live in CONVENTIONS.md(§3.2) — shared *objects* are not conventions and are still inlined.
2. **Example-first** — Every request and response must include realistic concrete examples. Schemas exist to supplement examples.
3. **Markdown-based** — Structured Markdown and fenced code blocks are the most stable format for LLM interpretation. docai must not be a YAML/JSON-only definition file.
4. **Deterministic structure** — Section order, heading levels, and required section roles are fixed. Heading text may be translated as part of the generated prose language, but a document set must use one translation consistently. Canonical keys and markers remain English format tokens. An LLM should be able to predict where information exists just from knowing the docai format.
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
- `source` is the source document or source system used to generate the file.
- `source_sha` is the source revision or content hash when available. Omit it only when no stable revision can be produced.

### 3.1 INDEX.md(required)

The entry point that an LLM reads first. List all endpoints, one endpoint per row.

```markdown
# API Index

| Method | Path | Summary | Details | Also read |
|---|---|---|---|---|
| POST | /users | Create user | resources/users.md | workflows/user-onboarding.md |
| GET | /users/{id} | Get user | resources/users.md | none |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | From cart validation to order confirmation | workflows/checkout.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles | webhooks/payment-completed.md |
```

- One endpoint per row. The LLM uses only this table to decide which file to read.
- Keep each summary within 80 UTF-8 bytes. The limit is in bytes so it is language-neutral: one token is roughly 4 UTF-8 bytes in any language, so 80 bytes ≈ 20 tokens(about 80 ASCII characters or 26 Japanese characters).
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
- Webhook delivery conventions(signature verification, sender identification), when the API sends webhooks

Each endpoint definition implicitly follows `CONVENTIONS.md`. Only deviations must be described in the endpoint itself, inside the section they affect and prefixed with the fixed marker `**deviation**:`(§4.1) so an LLM can locate them.

### 3.3 Output Profiles

docai supports two generated profiles. Both profiles must be generated from the same source of truth.

- `full` — the canonical reference profile. It preserves all request/response fields and behavior needed to match the source schema and is the default generation profile.
- `compact` — the LLM runtime profile. It reduces token usage while preserving enough information to call the API correctly for frontend or client implementation.

The `compact` profile may apply these reductions:

- Split large response tables into `frontend-visible fields` and `opaque fields`. `frontend-visible fields` are documented normally. `opaque fields` may be summarized by name, type, and one short meaning when the client normally stores or forwards them without inspecting their internals.
- Use minimal valid request examples. Include only required fields and optional fields that materially affect the call.
- Use representative response examples. Include common frontend-visible fields and omit rarely used optional fields unless they affect client logic.
- Keep shared `null`, default, pagination, sorting, filtering, common error, and rate-limit behavior in `CONVENTIONS.md`; endpoint files describe only deviations.
- For very large enums, standardized enums, or enums irrelevant to client branching, reference the standard or category instead of listing every value.
- Use short `none` lines such as `- Path: none`, `- Query: none`, and `- Body: none` as long as the fixed request order is preserved.

The `compact` profile must not omit information that changes how a caller constructs requests, handles errors, follows workflows, authenticates, retries, paginates, uploads/downloads files, or interprets state transitions.

## 4. Endpoint Definition Format

In a resource file, define each endpoint using the following template. **Section order, heading levels, and section roles are fixed**. Heading text may be translated consistently with the document language; canonical keys and markers must not be translated. Do not omit sections that do not apply. Write `none` instead so that an LLM can distinguish "intentionally none" from "forgotten". Request subsections whose entire content is `none` may be collapsed into one-line list items(§4.1).

````markdown
## POST /users

Creates a user. Email addresses are globally unique across all tenants.

### Behavior

- side_effects: On successful creation, a confirmation email is sent asynchronously
- idempotency: not idempotent. Use the `Idempotency-Key` header when retrying
- preconditions: caller must have the admin role
- authorization: `users:write` scope

### Request

- Path Parameters: none
- Query Parameters: none

#### Headers

| Name | Required | Constraints / Meaning |
|---|---|---|
| Idempotency-Key | no | Set only when retrying. Re-sending the same key returns the same result |

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

| Field | Type | Meaning |
|---|---|---|
| id | string | ULID with `usr_` prefix. Use this in later API calls |
| email | string | User email address |
| name | string | User name |
| role | string | `admin` or `member` |
| created_at | string (RFC 3339) | Creation timestamp |

#### Response Headers

| Name | Meaning |
|---|---|
| Location | URL of the created user(`/users/usr_01HXYZ`). Use it to fetch the resource |

### Errors

| Status | code | Condition | What the caller should do |
|---|---|---|---|
| 409 | email_taken | email already exists | Use another email. Do not retry |
| 422 | validation_failed | Input value is invalid | Show field-level errors in the form. Do not retry |

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
- If the endpoint is deprecated, put a `**deprecated**: <replacement endpoint and migration>` line immediately after the heading, before the description, and prefix its INDEX.md summary with `(deprecated)`. Omit the line entirely otherwise — there is no permanent `deprecated` label.

**Behavior(required)**
- Use these **four canonical keys in this order** so an LLM and validation tools can always locate each fact: `side_effects`, `idempotency`, `preconditions`, `authorization`. Write `none` for any that do not apply
- Canonical structural keys and markers are always written in English, even when generated prose is written in another language. This includes `side_effects`, `idempotency`, `preconditions`, `authorization`, `**deprecated**:`, and `**deviation**:`
- `side_effects`: list all(email sending, changes to other resources, event publishing, etc.)
- `idempotency`: state whether the endpoint is idempotent and whether it can be retried safely
- `preconditions`: earlier APIs that must be called, required resource state, etc.
- `authorization`: required scope/role(may overlap with `preconditions`; keep auth here)
- These are the pieces of information that OpenAPI has no natural place for and that LLMs are most likely to get wrong

**Request / Response**
- Put the **concrete example(JSON code block) first, then the field table**
- Use realistic example values(`"taro@example.com"` instead of `"string"` or `"foo"`)
- In the `full` profile, request examples should be representative valid examples and response examples should show the normal complete shape. In the `compact` profile, request examples should be minimal valid examples, and response examples should be representative examples focused on fields that affect client implementation
- Every field in the example must have a corresponding row in the field table
- Write requests in this order: `Path Parameters`, `Query Parameters`, `Headers`, `Body`. If a part does not apply, write `none`
- Request subsections whose entire content is `none` may drop the `####` heading and be written as one-line list items directly under `### Request`, keeping the fixed order(see the template). Subsections with content keep their `####` heading. `#### Response Headers` may likewise be collapsed to a one-line `- Response Headers: none`
- Path parameter tables use the columns `Name | Type | Constraints / Meaning`. There is no `Required` column — path parameters are always required
- Query parameter tables use the columns `Name | Type | Required | Constraints / Meaning`, with defaults in the constraints column:

  ```markdown
  | Name | Type | Required | Constraints / Meaning |
  |---|---|---|---|
  | page | int | no | 1-based. Defaults to `1` |
  ```

- If there is no body, write `none. Do not send a request body`
- If there is no response body, write `none. No response body is returned`
- Add a `#### Response Headers` table when the caller must read response headers(`Location`, `Set-Cookie`, `Retry-After`, `ETag`, `Link`, etc.). Write `none` when there are none. Document it per status code when it differs(for example, `Retry-After` only on 429)
- If there are multiple successful responses, split them by status code, such as `### Response 200`, `### Response 202`, and `### Response 204`
- For asynchronous acceptance such as `202 Accepted`, describe the endpoint used to check completion, polling interval, timeout, and failure-time state
- **Non-JSON responses**(file download, binary, CSV, Server-Sent Events streaming, etc.): state the `Content-Type` explicitly, and instead of a JSON block give a representative sample fragment plus a prose description of the semantics(for downloads: filename, size limit; for SSE: event names, frame format, terminate condition)
- Use simple type names: `string` / `int` / `float` / `bool` / `string[]` / `object` / `object[]` / `map<string, T>`. Reference notation such as `$ref` is prohibited
- Flatten nested objects in the table using dot notation such as `address.city`
- Flatten objects inside arrays using `[]`, such as `items[].id` and `items[].product.name`
- Use `map<string, T>` for objects with dynamic keys(OpenAPI `additionalProperties`), such as `map<string, int>`. Dynamic keys cannot be flattened with dot notation, so put the value shape in the type column and show a representative key in the example
- **Polymorphic fields(OpenAPI `oneOf` / `anyOf`)**: list every value of the discriminator field(such as `type`) as an enum in the table, include one JSON example per variant, and flatten variant-specific fields with the discriminator value as a prefix(such as `card.last4`) — or give each variant its own table. Schema-composition notation must not be used, just like `$ref`
- List all enum values in the constraints column. For large or standardized enums(ISO 4217 currency, country codes, etc.), reference the standard by name instead of enumerating every value
- `Required` means "cannot be omitted in a request". Omission and `null` are separate concepts
- Request field tables must include `Required` and `Nullable` columns
- For update endpoints(`PUT` / `PATCH`), mark fields that cannot be changed explicitly(an `Updatable` note in the constraints column, or `not updatable`). Also state the merge semantics of `PATCH`(for example, whether sending `null` clears the field)
- Specify default values when omitted, whether empty strings are allowed, whether empty arrays are allowed, and whether empty objects are allowed
- If a response field may be absent, specify the condition under which it is omitted or becomes `null`
- **Reuse the same example values across endpoints**: the `id` returned by a create example should reappear in the matching GET/list examples(for instance `usr_01HXYZ` everywhere). Consistent fixtures let an LLM trace a value through a whole workflow

**Errors(required)**
- Write only errors specific to this endpoint(common errors belong in CONVENTIONS.md)
- Always write the "condition" and "what the caller should do", including retryability. This information lets an LLM write error handling code
- Include a concrete error response example when the shape deviates from the common error shape in CONVENTIONS.md, or when the endpoint returns field-level errors. Errors that follow the common shape need only their table row
- For errors that should be displayed in forms or input UIs, include a field-level error response example
- For field-level errors, specify the target field name, machine-readable code, and whether the message can be shown to users

**Related(required)**
- Mention endpoints that are commonly called before or after this endpoint. This helps an LLM assemble the full workflow
- If a related workflow exists, link to it, such as `Workflow: workflows/checkout.md`

**Deviations from CONVENTIONS.md**
- Write a deviation inside the section it affects, prefixed with the fixed marker `**deviation**:`(for example, `**deviation**: this list API uses offset pagination instead of cursors`). The fixed marker lets an LLM find every deviation in a file

## 5. Workflow Definitions(workflows/, optional)

Operations that require multiple endpoints to be called in a specific order should be written as workflows.

```markdown
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

## 6. Webhook Definitions(webhooks/, optional)

Webhooks are calls in the reverse direction: the API sends an HTTP request to a URL registered by the client. They correspond to the top-level `webhooks` field in OpenAPI 3.1 and are documented apart from resources — one file per event(or per group of closely related events).

````markdown
# payment.completed

Sent when a payment settles. Delivered as `POST` to the registered URL.

### Payload

```json
{
  "event": "payment.completed",
  "payment_id": "pay_01HXYZ",
  "amount": 1200,
  "occurred_at": "2026-06-11T09:31:00Z"
}
```

| Field | Type | Meaning |
|---|---|---|
| event | string | Always `payment.completed` |
| payment_id | string | ULID with `pay_` prefix. Matches the id returned by POST /payments |
| amount | int | Settled amount in JPY |
| occurred_at | string (RFC 3339) | When the payment settled |

### Expected Response

Return a `2xx` status within 10 seconds. The response body is ignored.

### Retry

On non-`2xx` or timeout, delivery is retried up to 5 times with exponential backoff, then abandoned.

### Delivery Guarantees

- At-least-once. Deduplicate by `payment_id`
- Delivery order is not guaranteed
````

- Write the payload with the same example-first rule as responses: JSON example first, then the field table.
- Always state what the receiver must return(status code, response deadline) and the retry policy(count, interval, when delivery is abandoned).
- State delivery guarantees explicitly: at-least-once or at-most-once, ordering, and the field to deduplicate by.
- Signature verification and other conventions shared by all webhooks belong in CONVENTIONS.md.
- Webhook files must be discoverable from the `Webhooks` section in INDEX.md, and endpoints that trigger a webhook should mention it in their `Related` section.

## 7. Writing Style Rules

The per-section rules in §4.1 are normative — this section only adds cross-cutting style guidance and does not restate them.

- Keep each file to a size that loads comfortably as context. As a rough guide, split a resource once it grows past roughly 1,000 lines; tables are token-dense, so judge by tokens rather than line count when in doubt.
- Prefer tables, lists, and code blocks over prose.
- Avoid verbose expressions. Write directly and decisively.
- Explicitly state negative facts, such as "this field cannot be updated" or "this API does not paginate". LLMs fill in missing information by guessing, so clearly stating what is not possible prevents hallucination.
- Put metadata information(docai format version, profile, generation date, source, and source revision when available) at the beginning of **every file**, not only INDEX.md(see §3) — files are loaded individually.
- Do not omit information that affects frontend implementation. Examples: screen transition after authentication failure, retry display, mapping errors to form fields, download file name, upload size limit.
- Distinguish messages that may be used directly as UI copy from messages intended for logs or developers.
- Write each generated docai document set in a **single prose language**. Unlike this README(which is bilingual for human readers), generated docai must not repeat the same content in multiple languages — choose one output language and use it consistently across INDEX.md, CONVENTIONS.md, and all resource and workflow files. Canonical structural keys and markers remain English format tokens, not prose translations.

## 8. Relationship with OpenAPI

- **Conversion is one-directional: source → docai.** docai is a generated artifact. The authoritative source (OpenAPI document, code, etc.) is the **maintenance source of truth**; docai is the **reference the LLM reads**. Edit the source and regenerate docai — never the other way around.
- Because the source may be OpenAPI, the `full` profile's field tables must carry at least as much information as the OpenAPI schema, so generation loses nothing. The `compact` profile may intentionally reduce detail only under the rules in §3.3.
- docai does not replace OpenAPI. They coexist: OpenAPI continues to serve code generation, validation, and human browsing; docai serves LLM consumption.

## 9. Compliance Checklist

A document is docai-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist
- [ ] Every file(INDEX.md, CONVENTIONS.md, resources/, workflows/, webhooks/) begins with a metadata stamp(`docai` / `profile` / `generated` / `source`, and `source_sha` when available)
- [ ] INDEX.md lists the `Details` and `Also read` column roles for every endpoint
- [ ] Every endpoint follows the fixed template section structure and order
- [ ] Every request and response has a concrete example; errors include one when §4.1 requires it(shape deviates from CONVENTIONS.md, or field-level errors)
- [ ] Requests are split into path parameters, query parameters, headers, and body(all-`none` parts may be one-line list items)
- [ ] Successful responses are documented by status code, and body-less responses explicitly say `none`
- [ ] Response headers the caller must read are documented(or `none`); non-JSON responses state their `Content-Type`
- [ ] Reference notation such as `$ref` is not used
- [ ] Array, nesting, `null`, omission, and default-value behavior are specified
- [ ] For update endpoints, non-updatable fields and `PATCH` merge semantics are specified
- [ ] Every error includes the condition and what the caller should do
- [ ] Validation errors include a field-level error example
- [ ] The `Behavior` section uses the canonical keys `side_effects` / `idempotency` / `preconditions` / `authorization`(write `none` when none apply)
- [ ] Deviations from CONVENTIONS.md are marked with `**deviation**:` in the affected section
- [ ] Deprecated endpoints have a `**deprecated**:` line after the heading and `(deprecated)` in their INDEX.md summary
- [ ] Files under workflows/ are referenced from INDEX.md and from related endpoints
- [ ] Files under webhooks/ are listed in the `Webhooks` section of INDEX.md

---

# docai(日本語)

AI(LLM)向け API ドキュメントフォーマット定義

## 1. 概要

docai は、バックエンド API を **LLM が理解・利用すること** に最適化して記述するためのドキュメントフォーマットである。OpenAPI が「機械処理(コード生成・バリデーション)と人間の閲覧」を目的とするのに対し、docai は「LLM がコンテキストに読み込み、正しい API 呼び出しコードを一発で書けること」を唯一の目的とする。

docai は手書き保守を前提とせず、**単一ソース(OpenAPI ドキュメント、コードの注釈など)から生成される** ことを前提に設計されている。docai は LLM のために情報を意図的に重複させる(基本原則を参照)が、その重複は単一の正本からジェネレータが生成する場合にのみ安全に保守できる。**生成された docai の重複部分を手で編集することは非推奨**である(コピー間で内容が乖離するため)。

本書はフォーマットの **ルール定義のみ** を行う。ツールやジェネレータの実装は対象外。

### OpenAPI ではなく docai が必要な理由(設計の動機)

LLM にとって OpenAPI は以下の点で読みにくい:

- `$ref` による間接参照 — 1 つのエンドポイントを理解するために文書内を行き来する必要があり、コンテキスト上で「展開」コストがかかる
- JSON/YAML の深いネスト — 構造の把握にトークンを浪費する
- 例(example)が任意項目 — LLM はスキーマよりも具体例から学習する方が正確
- 副作用・呼び出し順序・ビジネスルールを書く場所がない

docai はこれらを反転させる: **参照なし・フラット・例が必須・振る舞いの記述が必須**。

## 2. 基本原則

1. **規約込みの自己完結(Self-contained with conventions)** — 1 つのエンドポイント定義は、`CONVENTIONS.md` と一緒に読むことで完全に理解できること。通常の読み込み順序は `INDEX.md` → `CONVENTIONS.md` → 選択した resource/workflow/webhook ファイルである。共通スキーマや共有ドメインオブジェクト(`User`、`Money`、`Address` など)であっても各エンドポイントにインライン展開して記述する。重複は許容する(LLM にとって重複はコストだが、参照解決はそれ以上のコストである)。重複コピー間の整合性は **ジェネレータの責務**(§1)であり、手で同期させることは非推奨。エンドポイントから括り出してよいのは API 全体の共通規約(CONVENTIONS.md、§3.2)のみであり、共有*オブジェクト*は規約ではないのでインライン展開する。
2. **例が一次情報(Example-first)** — すべてのリクエスト・レスポンスに現実的な具体例を必須とする。スキーマは例を補足するものと位置づける。
3. **Markdown を基盤とする** — LLM が最も安定して解釈できるのは構造化された Markdown とフェンス付きコードブロックである。YAML/JSON のみの定義ファイルにしない。
4. **構造の決定性** — セクションの順序・見出しレベル・必須セクションの役割を固定する。見出し文言は生成される本文言語に合わせて翻訳してよいが、ドキュメント一式では同じ翻訳を一貫して使う。canonical key と marker は英語のフォーマットトークンのままにする。LLM が「どこに何が書いてあるか」をフォーマット名だけで予測できるようにする。
5. **振る舞いを書く** — 副作用、冪等性、呼び出しの前提条件、エラー時の状態など、シグネチャから読み取れない情報こそを必須項目とする。
6. **1 ファイル 1 リソース** — コンテキストに必要な分だけ読み込めるよう、ファイルを分割する。

## 3. ファイル構成

```
docs/
  INDEX.md          # 必須: 全エンドポイントの一覧(1 行サマリ)
  CONVENTIONS.md    # 必須: API 全体の共通規約
  resources/
    users.md        # リソース単位のエンドポイント定義
    orders.md
  workflows/
    checkout.md     # 任意: 複数エンドポイントをまたぐ手順
  webhooks/
    payment-completed.md  # 任意: API が送信する webhook(OpenAPI 3.1 の `webhooks`)
```

ファイルは **個別にロードされる**(分割の目的そのもの)ため、鮮度情報を INDEX.md だけに置くことはできない。INDEX.md・CONVENTIONS.md・resources/・workflows/・webhooks/ 配下の各ファイルは、そのファイルだけをロードした LLM が鮮度と詳細度を判断できるよう、冒頭に 1 行のメタデータスタンプを置くこと:

```markdown
> docai: 1 | profile: full | generated: 2026-06-30 | source: openapi.yaml | source_sha: abc123
```

- `docai` は docai フォーマットバージョン。
- `profile` は `full` または `compact`(§3.3)。
- `generated` は生成日。
- `source` は生成元のドキュメントまたはシステム。
- `source_sha` は利用可能な場合の生成元リビジョンまたは内容ハッシュ。安定したリビジョンを生成できない場合のみ省略してよい。

### 3.1 INDEX.md(必須)

LLM が最初に読むエントリポイント。全エンドポイントを 1 行ずつ列挙する。

```markdown
# API Index

| Method | Path | 概要 | 詳細 | Also read |
|---|---|---|---|---|
| POST | /users | ユーザー作成 | resources/users.md | workflows/user-onboarding.md |
| GET | /users/{id} | ユーザー取得 | resources/users.md | none |

## Workflows

| 名前 | 概要 | 詳細 |
|---|---|---|
| チェックアウト | カート検証から注文確定まで | workflows/checkout.md |

## Webhooks

| 名前 | 概要 | 詳細 |
|---|---|---|
| payment.completed | 決済確定時に送信 | webhooks/payment-completed.md |
```

- 1 エンドポイント 1 行。LLM はこの表だけで「どのファイルを読むべきか」を判断する。
- 概要は UTF-8 で 80 バイト以内。言語に依存しない上限にするためバイト基準とする: どの言語でも 1 トークン ≈ 4 UTF-8 バイト程度なので、80 バイト ≈ 約 20 トークン(ASCII 約 80 文字、日本語約 26 文字)。
- `Also read` には、このエンドポイントで通常一緒に読むべき追加ファイル(workflow など)を列挙する。通常不要な場合は `none` と書く。
- workflows/ にファイルが存在する場合は、`Workflows` セクションに必ず列挙する。
- webhooks/ にファイルが存在する場合は、`Webhooks` セクションに必ず列挙する。

### 3.2 CONVENTIONS.md(必須)

全エンドポイントに共通する規約を **1 箇所だけ** に書く。各エンドポイント定義から繰り返しを排除できる唯一の例外である。記載必須項目:

- ベース URL と環境
- API バージョン規約(path、ヘッダ、またはその他の指定方法)
- 認証方式(ヘッダ名、トークンの取得方法、具体例)
- 認証状態の扱い(401 時の遷移、トークン更新、ログアウト、Cookie 利用時の `credentials` 指定)
- CORS、Cookie、CSRF に関する規約
- リクエスト形式(JSON、multipart/form-data、application/x-www-form-urlencoded など)
- 共通エラーレスポンスの形(401/403/429/500 など、全エンドポイント共通のもの)
- バリデーションエラーの形(フィールド単位エラーの表現、画面表示に使うメッセージ)
- ページネーション規約
- 一覧 API のソート、フィルタ、検索規約
- 日時・ID・金額などの表現規約(例: 「日時はすべて RFC 3339 / UTC」)
- `null`、空配列、空オブジェクト、空文字、省略されたフィールドの扱い
- ファイルアップロード、ファイルダウンロードの規約
- レート制限
- Webhook 配信の規約(署名検証、送信元の識別。API が webhook を送信する場合)

各エンドポイント定義は「CONVENTIONS.md に従う」ことを暗黙の前提とし、**逸脱する場合のみ** 個別に記述する。逸脱は影響するセクション内に固定マーカー `**deviation**:` を付けて書く(§4.1)。LLM がマーカーで逸脱を検出できるようにするためである。

### 3.3 出力プロファイル

docai は 2 種類の生成プロファイルを持つ。どちらのプロファイルも同じ source of truth から生成する。

- `full` — 正本となる参照プロファイル。生成元スキーマと一致するために必要なすべてのリクエスト/レスポンスフィールドと振る舞いを保持する。生成時のデフォルトプロファイル。
- `compact` — LLM 実行時向けプロファイル。フロントエンドまたはクライアント実装で API を正しく呼ぶために十分な情報を残しつつ、トークン使用量を削減する。

`compact` プロファイルでは、以下の削減を適用してよい:

- 大きなレスポンス表を `frontend-visible fields` と `opaque fields` に分ける。`frontend-visible fields` は通常どおり記述する。`opaque fields` は、クライアントが通常その内部を解釈せず保存または転送するだけであれば、名前・型・短い意味だけに要約してよい。
- リクエスト例は最小の有効例にする。必須フィールドと、呼び出しに実質的に影響する任意フィールドだけを含める。
- レスポンス例は代表例にする。フロントエンドから見える一般的なフィールドを含め、クライアントロジックに影響しない稀な任意フィールドは省略してよい。
- 共有の `null`、デフォルト値、ページネーション、ソート、フィルタ、共通エラー、レート制限の扱いは `CONVENTIONS.md` に置き、エンドポイント側には逸脱のみを書く。
- 非常に大きい enum、標準化された enum、またはクライアント分岐に不要な enum は、全値列挙ではなく標準名またはカテゴリ名で参照してよい。
- 固定順序を保つ限り、`- Path: none`、`- Query: none`、`- Body: none` のような短い `none` 行を使ってよい。

`compact` プロファイルでも、呼び出し側のリクエスト構築、エラー処理、ワークフロー追従、認証、リトライ、ページネーション、ファイルアップロード/ダウンロード、状態遷移の解釈を変える情報は省略してはならない。

## 4. エンドポイント定義フォーマット

リソースファイル内で、1 エンドポイントを以下のテンプレートで記述する。**セクションの順序・見出しレベル・セクションの役割は固定**。見出し文言はドキュメントの言語に合わせて一貫して翻訳してよいが、canonical key と marker は翻訳してはならない。該当なしのセクションは省略せず `なし` と明記する(「書き忘れ」と「該当なし」を LLM が区別できるようにするため)。内容が `なし` のみのリクエスト小節は、1 行のリスト項目に畳み込んでよい(§4.1)。

````markdown
## POST /users

ユーザーを作成する。メールアドレスは全テナントで一意。

### 振る舞い

- side_effects: 作成成功時、確認メールが非同期送信される
- idempotency: 冪等ではない。リトライ時は `Idempotency-Key` ヘッダを使うこと
- preconditions: 呼び出し元は admin ロールであること
- authorization: `users:write` スコープ

### リクエスト

- パスパラメータ: なし
- クエリパラメータ: なし

#### ヘッダ

| 名前 | 必須 | 制約・意味 |
|---|---|---|
| Idempotency-Key | no | リトライ時のみ指定。同じキーの再送は同じ結果を返す |

#### ボディ

```json
{
  "email": "taro@example.com",
  "name": "山田太郎",
  "role": "member"
}
```

| フィールド | 型 | 必須 | null可 | 制約・意味 |
|---|---|---|---|---|
| email | string | yes | no | RFC 5322。テナント内ではなく **全体で** 一意 |
| name | string | yes | no | 1〜100 文字 |
| role | string | no | no | `admin` \| `member`。省略時 `member` |

### レスポンス 201

```json
{
  "id": "usr_01HXYZ",
  "email": "taro@example.com",
  "name": "山田太郎",
  "role": "member",
  "created_at": "2026-06-11T09:30:00Z"
}
```

| フィールド | 型 | 意味 |
|---|---|---|
| id | string | `usr_` プレフィックス付き ULID。以後の API 呼び出しで使う |
| email | string | ユーザーのメールアドレス |
| name | string | ユーザー名 |
| role | string | `admin` または `member` |
| created_at | string (RFC 3339) | 作成日時 |

#### レスポンスヘッダ

| 名前 | 意味 |
|---|---|
| Location | 作成されたユーザーの URL(`/users/usr_01HXYZ`)。リソース取得に使う |

### エラー

| ステータス | code | 発生条件 | 呼び出し側がすべき対応 |
|---|---|---|---|
| 409 | email_taken | email が既に存在 | 別の email を使う。リトライ不可 |
| 422 | validation_failed | 入力値が不正 | フィールド単位エラーをフォームに表示する。リトライ不可 |

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

### 関連

- 作成後の取得: GET /users/{id}
- 一覧: GET /users
- ワークフロー: workflows/user-onboarding.md
````

### 4.1 各セクションのルール

**見出し(`## METHOD /path`)**
- メソッドとパスをそのまま見出しにする。パスパラメータは `{id}` 形式。
- 直後の 1〜2 文でエンドポイントの目的を書く。実装の説明ではなく「何のために呼ぶか」を書く。
- 廃止予定のエンドポイントは、見出し直後・説明文の前に `**deprecated**: <代替エンドポイントと移行方法>` の 1 行を置き、INDEX.md の概要欄の先頭に `(deprecated)` を付ける。該当しない場合はこの行自体を書かない — 常設の `deprecated` ラベルは設けない。

**振る舞い(必須)**
- LLM と検証ツールが各情報を常に同じ場所で拾えるよう、**canonical key をこの順序で**使う: `side_effects`、`idempotency`、`preconditions`、`authorization`。該当しないものは `なし` と書く
- canonical key と marker は、生成される本文が日本語など英語以外でも常に英語で書く。対象は `side_effects`、`idempotency`、`preconditions`、`authorization`、`**deprecated**:`、`**deviation**:` を含む
- `side_effects`: メール送信、他リソースの変更、イベント発行などをすべて列挙する
- `idempotency`: 冪等性の有無と、安全にリトライできるかを明記する
- `preconditions`: 先に呼ぶべき API、必要な状態などを明記する
- `authorization`: 必要なスコープ/ロール(`preconditions` と重なることがあるが、認可はここに書く)
- これらは OpenAPI に書く場所がなく、かつ LLM が最も誤りやすい情報である

**リクエスト / レスポンス**
- **具体例(JSON コードブロック)を先、フィールド表を後** に置く
- 例は現実的な値を使う(`"string"` や `"foo"` ではなく `"taro@example.com"`)
- `full` プロファイルでは、リクエスト例は代表的な有効例、レスポンス例は通常の完全な形を示す。`compact` プロファイルでは、リクエスト例は最小の有効例、レスポンス例はクライアント実装に影響するフィールド中心の代表例にする
- 例の中のすべてのフィールドは表に対応行があること
- リクエストは `パスパラメータ`、`クエリパラメータ`、`ヘッダ`、`ボディ` の順で書く。該当しないものは `なし` と書く
- 内容が `なし` のみの小節は `####` 見出しを立てず、`### リクエスト` 直下の 1 行のリスト項目に畳み込んでよい(固定順序は維持。テンプレート参照)。内容がある小節は従来どおり `####` 見出しを使う。`#### レスポンスヘッダ` も同様に `- レスポンスヘッダ: なし` の 1 行に畳み込んでよい
- パスパラメータの表は `名前 | 型 | 制約・意味` の列を使う。パスパラメータは常に必須のため `必須` 列は置かない
- クエリパラメータの表は `名前 | 型 | 必須 | 制約・意味` の列を使い、デフォルト値は制約欄に書く:

  ```markdown
  | 名前 | 型 | 必須 | 制約・意味 |
  |---|---|---|---|
  | page | int | no | 1 始まり。省略時 `1` |
  ```

- ボディがない場合は `なし。リクエストボディは送信しない` と明記する
- レスポンスボディがない場合は `なし。レスポンスボディは返らない` と明記する
- 呼び出し側がレスポンスヘッダ(`Location`、`Set-Cookie`、`Retry-After`、`ETag`、`Link` など)を読む必要がある場合は `#### レスポンスヘッダ` の表を追加する。該当なしは `なし`。ステータスごとに異なる場合はステータス単位で書く(例: `Retry-After` は 429 のみ)
- 成功レスポンスが複数ある場合は `### レスポンス 200`、`### レスポンス 202`、`### レスポンス 204` のようにステータスごとに分ける
- `202 Accepted` のような非同期受付では、完了確認に使うエンドポイント、ポーリング間隔、タイムアウト、失敗時の状態を明記する
- **非 JSON レスポンス**(ファイルダウンロード、バイナリ、CSV、Server-Sent Events ストリーミング等)は、`Content-Type` を明記し、JSON ブロックの代わりに代表的なサンプル断片とセマンティクスの散文説明を書く(ダウンロード: ファイル名・サイズ上限。SSE: イベント名・フレーム形式・終了条件)
- 型は `string` / `int` / `float` / `bool` / `string[]` / `object` / `object[]` / `map<string, T>` の平易な表記とする。`$ref` 等の参照記法は禁止
- ネストしたオブジェクトは表内で `address.city` のようにドット記法で平坦に書く
- 配列内のオブジェクトは `items[].id`、`items[].product.name` のように `[]` を使って平坦に書く
- 動的キーのオブジェクト(OpenAPI の `additionalProperties`)は `map<string, int>` のように `map<string, T>` で表す。動的キーはドット記法で平坦化できないため、値の形を型欄に書き、例には代表的なキーを載せる
- **多態フィールド(OpenAPI の `oneOf` / `anyOf`)**: 判別フィールド(例: `type`)の全値を表の enum として列挙し、種別ごとに JSON 例を 1 つずつ載せ、種別固有のフィールドは `card.last4` のように判別値をプレフィックスにして平坦に書く(または種別ごとに表を分ける)。`$ref` と同様、スキーマ合成記法は使わない
- enum は制約欄に全値を列挙する。大規模または標準化された enum(ISO 4217 通貨、国コード等)は、全値を列挙せず標準名を参照する
- `必須` は「リクエスト時に省略できない」ことを表す。省略可否と `null` 可否は別物として扱う
- リクエストのフィールド表には `必須` と `null可` の列を置く
- 更新系エンドポイント(`PUT` / `PATCH`)では、変更できないフィールドを明示する(制約欄に `更新可否` の注記、または `更新不可`)。`PATCH` のマージ意味論(例: `null` 送信でフィールドをクリアするか)も明記する
- 省略時のデフォルト値、空文字の可否、空配列の可否、空オブジェクトの可否は制約欄に明記する
- レスポンスでフィールドが存在しない可能性がある場合は、`省略される条件` または `null になる条件` を意味欄に明記する
- **エンドポイント間で同じ例データを使い回す**: create の例が返す `id` を、対応する GET/一覧の例にも再登場させる(例: どこでも `usr_01HXYZ`)。一貫したフィクスチャにより LLM が値をワークフロー全体で追跡できる

**エラー(必須)**
- このエンドポイント固有のエラーのみ書く(共通エラーは CONVENTIONS.md)
- 「発生条件」と「**呼び出し側がすべき対応**(リトライ可否を含む)」を必ず書く。LLM がエラーハンドリングコードを書くための情報である
- エラーレスポンスの具体例は、形が CONVENTIONS.md の共通エラー形から逸脱する場合、またはフィールド単位エラーを返す場合に含める。共通形どおりのエラーは表の行だけでよい
- フォームや入力 UI に表示すべきエラーは、フィールド単位エラーのレスポンス例を含める
- フィールド単位エラーでは、対象フィールド名、機械判定用 code、ユーザー表示可能な message の有無を明記する

**関連(必須)**
- 前後に呼ぶことになるエンドポイントへの言及。LLM がワークフロー全体を組み立てる手がかりになる
- 関連する workflow がある場合は、`ワークフロー: workflows/checkout.md` のようにリンクする

**CONVENTIONS.md からの逸脱**
- 逸脱は影響するセクション内に、固定マーカー `**deviation**:` を付けて書く(例: `**deviation**: この一覧 API はカーソルではなくオフセットページネーションを使う`)。固定マーカーにより LLM がファイル内の逸脱をすべて検出できる

## 5. ワークフロー定義(workflows/、任意)

複数のエンドポイントを特定の順序で呼ぶ必要がある操作は、ワークフローとして記述する。

```markdown
# チェックアウト

注文確定までの手順。

1. POST /carts/{id}/validate — 在庫を確認する。409 なら数量を修正して再試行
2. POST /payments — `cart_id` を渡す。`payment_id` を控える
3. POST /orders — `payment_id` を渡す。ここで初めて在庫が確保される

注意: 手順 2 と 3 の間が 15 分を超えると payment は失効する(410 が返る)。
```

- 番号付きリストで順序を表現し、各ステップに「受け渡す値」と「失敗時の分岐」を書く。
- 状態遷移がある場合(例: 注文ステータス)は、遷移可能な状態の一覧と遷移を起こすエンドポイントを表で書く。
- workflow ファイルは INDEX.md の `Workflows` セクションから参照できるようにする。
- 関係する各エンドポイントの `関連` セクションからも workflow を参照する。

## 6. Webhook 定義(webhooks/、任意)

Webhook は方向が逆の呼び出しである: API がクライアントの登録した URL へ HTTP リクエストを送信する。OpenAPI 3.1 のトップレベルフィールド `webhooks` に対応し、リソースとは分けて記述する — 1 イベント(または密接に関連するイベント群)につき 1 ファイル。

````markdown
# payment.completed

決済確定時に送信される。登録 URL へ `POST` で配信される。

### ペイロード

```json
{
  "event": "payment.completed",
  "payment_id": "pay_01HXYZ",
  "amount": 1200,
  "occurred_at": "2026-06-11T09:31:00Z"
}
```

| フィールド | 型 | 意味 |
|---|---|---|
| event | string | 常に `payment.completed` |
| payment_id | string | `pay_` プレフィックス付き ULID。POST /payments が返す id と一致する |
| amount | int | 確定金額(JPY) |
| occurred_at | string (RFC 3339) | 決済確定日時 |

### 期待されるレスポンス

10 秒以内に `2xx` を返すこと。レスポンスボディは無視される。

### リトライ

`2xx` 以外またはタイムアウト時は、指数バックオフで最大 5 回リトライし、その後配信を打ち切る。

### 配信保証

- at-least-once。`payment_id` で重複排除すること
- 配信順序は保証されない
````

- ペイロードはレスポンスと同じ「例が先」ルールで書く: JSON 例が先、フィールド表が後。
- 受信側が返すべきもの(ステータスコード、応答期限)とリトライポリシー(回数、間隔、打ち切り条件)を必ず書く。
- 配信保証を明記する: at-least-once か at-most-once か、順序保証、重複排除に使うフィールド。
- 署名検証など全 webhook 共通の規約は CONVENTIONS.md に書く。
- webhook ファイルは INDEX.md の `Webhooks` セクションから参照できるようにし、webhook を発生させるエンドポイントの `関連` セクションからも言及する。

## 7. 記述スタイル規約

各セクションのルール(§4.1)が正(normative)である。本節は横断的なスタイル指針のみを補足し、§4.1 を再掲しない。

- 1 ファイルはコンテキストとして無理なくロードできるサイズに収める。目安として 1,000 行を超えたらリソースを分割する。表はトークン密度が高いため、迷う場合は行数ではなくトークン数で判断する
- 散文より表・リスト・コードブロックを優先する
- 「〜することができます」のような冗長表現を避け、断定で書く
- 否定的な事実も明記する(「このフィールドは更新できない」「この API はページネーションしない」)。LLM は書かれていないことを推測で補うため、できないことの明示が幻覚を防ぐ
- メタデータ情報(docai フォーマットバージョン、profile、生成日、生成元、利用可能な場合は生成元リビジョン)は INDEX.md だけでなく **すべてのファイル** の冒頭に置く(§3 参照)。ファイルは個別にロードされるため
- フロントエンド実装に影響する情報は省略しない。例: 認証失敗時の画面遷移、リトライ表示、フォームへのエラー割り当て、ダウンロードファイル名、アップロード上限
- UI 文言としてそのまま使ってよい message と、ログ・開発者向け message は区別して書く
- 生成される docai ドキュメント一式は **単一の本文言語** で記述する。このREADME(人間向けに二言語併記)とは異なり、生成された docai は同じ内容を複数言語で繰り返してはならない — 出力言語を 1 つ選び、INDEX.md・CONVENTIONS.md・全リソース/ワークフローファイルで一貫して使う。canonical key と marker は本文翻訳ではなく英語のフォーマットトークンとして扱う。

## 8. OpenAPI との関係

- **変換は一方向(ソース → docai)とする。** docai は生成物である。正本(OpenAPI ドキュメント、コード等)が **保守上の source of truth** であり、docai は **LLM が読む参照用** である。ソースを編集して docai を再生成する。逆向きの編集は行わない。
- ソースが OpenAPI であり得るため、`full` プロファイルのフィールド表の情報量は OpenAPI スキーマと同等以上を保ち、生成時に情報が失われないようにする。`compact` プロファイルは §3.3 のルールに従う場合のみ、意図的に詳細を削減してよい。
- docai は OpenAPI を置き換えない。併存する:OpenAPI は引き続きコード生成・バリデーション・人間の閲覧に使い、docai は LLM 消費に使う。

## 9. 準拠チェックリスト

ドキュメントが docai 準拠であるための条件:

- [ ] INDEX.md と CONVENTIONS.md が存在する
- [ ] すべてのファイル(INDEX.md・CONVENTIONS.md・resources/・workflows/・webhooks/)の冒頭にメタデータスタンプ(`docai` / `profile` / `generated` / `source`、利用可能な場合は `source_sha`)がある
- [ ] INDEX.md がすべてのエンドポイントに `Details` と `Also read` の列役割を持っている
- [ ] すべてのエンドポイントが固定テンプレートのセクション構成・順序に従っている
- [ ] すべてのリクエスト・レスポンスに具体例がある。エラーは §4.1 が要求する場合(共通エラー形からの逸脱、またはフィールド単位エラー)に具体例がある
- [ ] リクエストがパスパラメータ・クエリパラメータ・ヘッダ・ボディに分けて記述されている(すべて `なし` の部分は 1 行のリスト項目でよい)
- [ ] 成功レスポンスがステータスごとに記述され、ボディなしの場合は `なし` と明記されている
- [ ] 呼び出し側が読むべきレスポンスヘッダが記述されている(または `なし`)。非 JSON レスポンスは `Content-Type` を明記している
- [ ] `$ref` 等の参照記法を使っていない
- [ ] 配列、ネスト、`null`、省略、デフォルト値の扱いが明記されている
- [ ] 更新系エンドポイントで、更新不可フィールドと `PATCH` のマージ意味論が明記されている
- [ ] すべてのエラーに「発生条件」と「呼び出し側の対応」がある
- [ ] バリデーションエラーにフィールド単位エラーの例がある
- [ ] 「振る舞い」セクションが canonical key `side_effects` / `idempotency` / `preconditions` / `authorization` を使っている(なしの場合も `なし` と記載)
- [ ] CONVENTIONS.md からの逸脱が、影響するセクション内で `**deviation**:` マーカー付きで記述されている
- [ ] 廃止予定のエンドポイントに、見出し直後の `**deprecated**:` 行と INDEX.md 概要欄の `(deprecated)` がある
- [ ] workflows/ のファイルが INDEX.md から参照され、関連エンドポイントからも参照されている
- [ ] webhooks/ のファイルが INDEX.md の `Webhooks` セクションに列挙されている
