# docai — API Documentation Format for AI/LLM

docai is a documentation format for describing backend APIs in a way that is optimized for AI/LLM consumption.
It is designed so that an AI can read the API documentation as context and efficiently implement a web frontend that calls the API correctly.

> **日本語の説明は英語の説明の後に記載されています。** [→ 日本語版へジャンプ](#docai日本語)
> *Japanese documentation follows the English documentation below.*

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Core Principles](#2-core-principles)
- [3. File Structure](#3-file-structure)
- [4. Endpoint Definition Format](#4-endpoint-definition-format)
- [5. Workflow Definitions](#5-workflow-definitions-workflows-optional)
- [6. Writing Style Rules](#6-writing-style-rules)
- [7. Relationship with OpenAPI](#7-relationship-with-openapi)
- [8. Compliance Checklist](#8-compliance-checklist)
- [docai(日本語)](#docai日本語)

---

## 1. Overview

docai is a documentation format for describing backend APIs in a way that is optimized for **LLMs to understand and use**. OpenAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, docai has one purpose: **allow an LLM to load the documentation into context and write correct API-calling code on the first attempt**.

This document defines only the **format rules**. It does not cover tools or generator implementations.

### Why docai is needed instead of only OpenAPI

OpenAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` — understanding one endpoint requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- There is no natural place to write side effects, call order, or business rules

docai reverses these tradeoffs: **no references, flat structure, required examples, and required behavior descriptions**.

## 2. Core Principles

1. **Self-contained** — One endpoint definition must be fully understandable on its own without referring to other sections. Even common schemas must be expanded inline in each endpoint. Duplication is acceptable. For LLMs, duplication has a cost, but reference resolution is more expensive.
2. **Example-first** — Every request and response must include realistic concrete examples. Schemas exist to supplement examples.
3. **Markdown-based** — Structured Markdown and fenced code blocks are the most stable format for LLM interpretation. docai must not be a YAML/JSON-only definition file.
4. **Deterministic structure** — Section order and heading levels are fixed. An LLM should be able to predict where information exists just from knowing the docai format.
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
```

### 3.1 INDEX.md(required)

The entry point that an LLM reads first. List all endpoints, one endpoint per row.

```markdown
# API Index

| Method | Path | Summary | Details |
|---|---|---|---|
| POST | /users | Create user | resources/users.md |
| GET | /users/{id} | Get user | resources/users.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | From cart validation to order confirmation | workflows/checkout.md |
```

- One endpoint per row. The LLM uses only this table to decide which file to read.
- Keep the summary within 40 characters.
- If files exist under workflows/, list them in the `Workflows` section.

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

Each endpoint definition implicitly follows `CONVENTIONS.md`. Only deviations must be described in the endpoint itself.

## 4. Endpoint Definition Format

In a resource file, define each endpoint using the following template. **Section order and headings are fixed**. Do not omit sections that do not apply. Write `none` instead so that an LLM can distinguish "intentionally none" from "forgotten".

````markdown
## POST /users

Creates a user. Email addresses are globally unique across all tenants.

### Behavior

- On successful creation, a confirmation email is sent asynchronously(side effect)
- Idempotency: none. Use the `Idempotency-Key` header when retrying
- Preconditions: caller must have the admin role
- Authorization: `users:write` scope

### Request

#### Path Parameters

none

#### Query Parameters

none

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

**Behavior(required)**
- List all side effects(email sending, changes to other resources, event publishing, etc.)
- State whether the endpoint is idempotent and whether it can be retried safely
- State preconditions(earlier APIs that must be called, required resource state, etc.)
- These are the pieces of information that OpenAPI has no natural place for and that LLMs are most likely to get wrong

**Request / Response**
- Put the **concrete example(JSON code block) first, then the field table**
- Use realistic example values(`"taro@example.com"` instead of `"string"` or `"foo"`)
- Every field in the example must have a corresponding row in the field table
- Write requests in this order: `Path Parameters`, `Query Parameters`, `Headers`, `Body`. If a part does not apply, write `none`
- If there is no body, write `none. Do not send a request body`
- If there is no response body, write `none. No response body is returned`
- If there are multiple successful responses, split them by status code, such as `### Response 200`, `### Response 202`, and `### Response 204`
- For asynchronous acceptance such as `202 Accepted`, describe the endpoint used to check completion, polling interval, timeout, and failure-time state
- Use simple type names: `string` / `int` / `float` / `bool` / `string[]` / `object` / `object[]`. Reference notation such as `$ref` is prohibited
- Flatten nested objects in the table using dot notation such as `address.city`
- Flatten objects inside arrays using `[]`, such as `items[].id` and `items[].product.name`
- List all enum values in the constraints column
- `Required` means "cannot be omitted in a request". Omission and `null` are separate concepts
- Request field tables must include `Required` and `Nullable` columns
- Specify default values when omitted, whether empty strings are allowed, whether empty arrays are allowed, and whether empty objects are allowed
- If a response field may be absent, specify the condition under which it is omitted or becomes `null`

**Errors(required)**
- Write only errors specific to this endpoint(common errors belong in CONVENTIONS.md)
- Always write the "condition" and "what the caller should do", including retryability. This information lets an LLM write error handling code
- Include at least one concrete error response example
- For errors that should be displayed in forms or input UIs, include a field-level error response example
- For field-level errors, specify the target field name, machine-readable code, and whether the message can be shown to users

**Related(required)**
- Mention endpoints that are commonly called before or after this endpoint. This helps an LLM assemble the full workflow
- If a related workflow exists, link to it, such as `Workflow: workflows/checkout.md`

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

## 6. Writing Style Rules

- Keep each file within about 1,000 lines(roughly 10,000 tokens). If it grows beyond that, split the resource.
- Prefer tables, lists, and code blocks over prose.
- Avoid verbose expressions. Write directly and decisively.
- Explicitly state negative facts, such as "this field cannot be updated" or "this API does not paginate". LLMs fill in missing information by guessing, so clearly stating what is not possible prevents hallucination.
- Put freshness information such as version and date at the beginning of INDEX.md.
- Do not omit information that affects frontend implementation. Examples: screen transition after authentication failure, retry display, mapping errors to form fields, download file name, upload size limit.
- Distinguish messages that may be used directly as UI copy from messages intended for logs or developers.

## 7. Relationship with OpenAPI

- docai does not replace OpenAPI; it can coexist with OpenAPI. To keep future machine conversion from OpenAPI possible, field tables must contain at least as much information as OpenAPI schemas.
- However, for LLM-oriented operation, docai is the source of truth.

## 8. Compliance Checklist

A document is docai-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist
- [ ] Every endpoint follows the fixed template section structure and order
- [ ] Every request, response, and error has a concrete example
- [ ] Requests are split into path parameters, query parameters, headers, and body
- [ ] Successful responses are documented by status code, and body-less responses explicitly say `none`
- [ ] Reference notation such as `$ref` is not used(except for implicit compliance with CONVENTIONS.md)
- [ ] Array, nesting, `null`, omission, and default-value behavior are specified
- [ ] Every error includes the condition and what the caller should do
- [ ] Validation errors include a field-level error example
- [ ] Side effects, idempotency, and preconditions are written in the `Behavior` section(write `none` when none apply)
- [ ] Files under workflows/ are referenced from INDEX.md and from related endpoints

---

# docai(日本語)

AI(LLM)向け API ドキュメントフォーマット定義

## 1. 概要

docai は、バックエンド API を **LLM が理解・利用すること** に最適化して記述するためのドキュメントフォーマットである。OpenAPI が「機械処理(コード生成・バリデーション)と人間の閲覧」を目的とするのに対し、docai は「LLM がコンテキストに読み込み、正しい API 呼び出しコードを一発で書けること」を唯一の目的とする。

本書はフォーマットの **ルール定義のみ** を行う。ツールやジェネレータの実装は対象外。

### OpenAPI ではなく docai が必要な理由(設計の動機)

LLM にとって OpenAPI は以下の点で読みにくい:

- `$ref` による間接参照 — 1 つのエンドポイントを理解するために文書内を行き来する必要があり、コンテキスト上で「展開」コストがかかる
- JSON/YAML の深いネスト — 構造の把握にトークンを浪費する
- 例(example)が任意項目 — LLM はスキーマよりも具体例から学習する方が正確
- 副作用・呼び出し順序・ビジネスルールを書く場所がない

docai はこれらを反転させる: **参照なし・フラット・例が必須・振る舞いの記述が必須**。

## 2. 基本原則

1. **自己完結(Self-contained)** — 1 つのエンドポイント定義は、他の箇所を参照せずに単独で完全に理解できること。共通スキーマであっても各エンドポイントにインライン展開して記述する。重複は許容する(LLM にとって重複はコストだが、参照解決はそれ以上のコストである)。
2. **例が一次情報(Example-first)** — すべてのリクエスト・レスポンスに現実的な具体例を必須とする。スキーマは例を補足するものと位置づける。
3. **Markdown を基盤とする** — LLM が最も安定して解釈できるのは構造化された Markdown とフェンス付きコードブロックである。YAML/JSON のみの定義ファイルにしない。
4. **構造の決定性** — セクションの順序・見出しレベルを固定する。LLM が「どこに何が書いてあるか」をフォーマット名だけで予測できるようにする。
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
```

### 3.1 INDEX.md(必須)

LLM が最初に読むエントリポイント。全エンドポイントを 1 行ずつ列挙する。

```markdown
# API Index

| Method | Path | 概要 | 詳細 |
|---|---|---|---|
| POST | /users | ユーザー作成 | resources/users.md |
| GET | /users/{id} | ユーザー取得 | resources/users.md |

## Workflows

| 名前 | 概要 | 詳細 |
|---|---|---|
| チェックアウト | カート検証から注文確定まで | workflows/checkout.md |
```

- 1 エンドポイント 1 行。LLM はこの表だけで「どのファイルを読むべきか」を判断する。
- 概要は 40 文字以内。
- workflows/ にファイルが存在する場合は、`Workflows` セクションに必ず列挙する。

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

各エンドポイント定義は「CONVENTIONS.md に従う」ことを暗黙の前提とし、**逸脱する場合のみ** 個別に記述する。

## 4. エンドポイント定義フォーマット

リソースファイル内で、1 エンドポイントを以下のテンプレートで記述する。**セクションの順序と見出しは固定**。該当なしのセクションは省略せず `なし` と明記する(「書き忘れ」と「該当なし」を LLM が区別できるようにするため)。

````markdown
## POST /users

ユーザーを作成する。メールアドレスは全テナントで一意。

### 振る舞い

- 作成成功時、確認メールが非同期送信される(副作用)
- 冪等性: なし。リトライ時は `Idempotency-Key` ヘッダを使うこと
- 前提条件: 呼び出し元は admin ロールであること
- 認可: `users:write` スコープ

### リクエスト

#### パスパラメータ

なし

#### クエリパラメータ

なし

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

**振る舞い(必須)**
- 副作用(メール送信、他リソースの変更、イベント発行)をすべて列挙する
- 冪等性の有無と、安全にリトライできるかを明記する
- 前提条件(先に呼ぶべき API、必要な状態)を明記する
- これらは OpenAPI に書く場所がなく、かつ LLM が最も誤りやすい情報である

**リクエスト / レスポンス**
- **具体例(JSON コードブロック)を先、フィールド表を後** に置く
- 例は現実的な値を使う(`"string"` や `"foo"` ではなく `"taro@example.com"`)
- 例の中のすべてのフィールドは表に対応行があること
- リクエストは `パスパラメータ`、`クエリパラメータ`、`ヘッダ`、`ボディ` の順で書く。該当しないものは `なし` と書く
- ボディがない場合は `なし。リクエストボディは送信しない` と明記する
- レスポンスボディがない場合は `なし。レスポンスボディは返らない` と明記する
- 成功レスポンスが複数ある場合は `### レスポンス 200`、`### レスポンス 202`、`### レスポンス 204` のようにステータスごとに分ける
- `202 Accepted` のような非同期受付では、完了確認に使うエンドポイント、ポーリング間隔、タイムアウト、失敗時の状態を明記する
- 型は `string` / `int` / `float` / `bool` / `string[]` / `object` / `object[]` の平易な表記とする。`$ref` 等の参照記法は禁止
- ネストしたオブジェクトは表内で `address.city` のようにドット記法で平坦に書く
- 配列内のオブジェクトは `items[].id`、`items[].product.name` のように `[]` を使って平坦に書く
- enum は制約欄に全値を列挙する
- `必須` は「リクエスト時に省略できない」ことを表す。省略可否と `null` 可否は別物として扱う
- リクエストのフィールド表には `必須` と `null可` の列を置く
- 省略時のデフォルト値、空文字の可否、空配列の可否、空オブジェクトの可否は制約欄に明記する
- レスポンスでフィールドが存在しない可能性がある場合は、`省略される条件` または `null になる条件` を意味欄に明記する

**エラー(必須)**
- このエンドポイント固有のエラーのみ書く(共通エラーは CONVENTIONS.md)
- 「発生条件」と「**呼び出し側がすべき対応**(リトライ可否を含む)」を必ず書く。LLM がエラーハンドリングコードを書くための情報である
- エラーレスポンスの具体例を 1 つ以上含める
- フォームや入力 UI に表示すべきエラーは、フィールド単位エラーのレスポンス例を含める
- フィールド単位エラーでは、対象フィールド名、機械判定用 code、ユーザー表示可能な message の有無を明記する

**関連(必須)**
- 前後に呼ぶことになるエンドポイントへの言及。LLM がワークフロー全体を組み立てる手がかりになる
- 関連する workflow がある場合は、`ワークフロー: workflows/checkout.md` のようにリンクする

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

## 6. 記述スタイル規約

- 1 ファイルは 1,000 行(目安 10,000 トークン)以内に収める。超える場合はリソースを分割する
- 散文より表・リスト・コードブロックを優先する
- 「〜することができます」のような冗長表現を避け、断定で書く
- 否定的な事実も明記する(「このフィールドは更新できない」「この API はページネーションしない」)。LLM は書かれていないことを推測で補うため、できないことの明示が幻覚を防ぐ
- バージョンや日付などドキュメントの鮮度情報を INDEX.md の冒頭に置く
- フロントエンド実装に影響する情報は省略しない。例: 認証失敗時の画面遷移、リトライ表示、フォームへのエラー割り当て、ダウンロードファイル名、アップロード上限
- UI 文言としてそのまま使ってよい message と、ログ・開発者向け message は区別して書く

## 7. OpenAPI との関係

- docai は OpenAPI を置き換えるものではなく、併存できる。OpenAPI からの機械変換を将来の選択肢として妨げないよう、フィールド表の情報量は OpenAPI スキーマと同等以上を保つこと
- ただし正は docai 側とする(LLM 向け運用において)

## 8. 準拠チェックリスト

ドキュメントが docai 準拠であるための条件:

- [ ] INDEX.md と CONVENTIONS.md が存在する
- [ ] すべてのエンドポイントが固定テンプレートのセクション構成・順序に従っている
- [ ] すべてのリクエスト・レスポンス・エラーに具体例がある
- [ ] リクエストがパスパラメータ・クエリパラメータ・ヘッダ・ボディに分けて記述されている
- [ ] 成功レスポンスがステータスごとに記述され、ボディなしの場合は `なし` と明記されている
- [ ] `$ref` 等の参照記法を使っていない(CONVENTIONS.md への暗黙準拠を除く)
- [ ] 配列、ネスト、`null`、省略、デフォルト値の扱いが明記されている
- [ ] すべてのエラーに「発生条件」と「呼び出し側の対応」がある
- [ ] バリデーションエラーにフィールド単位エラーの例がある
- [ ] 副作用・冪等性・前提条件が「振る舞い」セクションに明記されている(なしの場合も `なし` と記載)
- [ ] workflows/ のファイルが INDEX.md から参照され、関連エンドポイントからも参照されている
