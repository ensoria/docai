# DocAI Messaging — Message-Driven API Documentation Format for AI/LLM

DocAI Messaging is a documentation format for describing message-driven APIs — event streams, message queues, publish/subscribe channels, and request-reply messaging — in a way that is optimized for AI/LLM consumption.
It is designed so that an AI can read the documentation as context and efficiently implement an application that produces and consumes messages correctly. It covers broker-based protocols(Kafka, AMQP, MQTT, NATS, JMS, cloud queues) and connection-based protocols(WebSocket) alike, wherever the interaction is asynchronous message exchange rather than synchronous request/response.

> Specification version: 0.2.0 | status: Draft

> Publication label: Design-review draft.

This is the second design draft of DocAI Messaging. No conformance corpus, fixtures, or generator exists yet. Publishing this draft does not declare any structure an implementation target; before a release may advertise a compatibility-preserving implementation target, it must publish versioned fixtures for the structures it promises, following the same publication-label discipline as [DocAI HTTP](../docai-http/README.md) §9.1. DocAI Messaging is versioned independently from DocAI HTTP, but deliberately reuses its compatibility model, marker vocabulary, and table grammar so that a reader or tool that knows one format can learn the other cheaply.

Changes are recorded in the repository history. The sibling format for HTTP APIs is [DocAI HTTP](../docai-http/README.md); an API that exposes both an HTTP surface and a messaging surface publishes one document set per format, cross-linked through `Also read` and `Related`.

### LLM Reader Quick Path (non-normative)

Readers that need to use a generated DocAI Messaging set do not need to load this entire specification. For task implementation, prefer the generated set's own retrieval path: `INDEX.md` → `CONVENTIONS.md` → selected channel/workflow files(§6.1).

For understanding this specification with minimal context, load §3.2 for `INDEX.md`, §3.3 for `CONVENTIONS.md`, §4 for the operation structure, and §6.1 for the retrieval recipe. Producers, validators, and specification reviewers should read the full document, especially the compatibility rules(§3.1), incomplete-information rules(§3.4), canonical syntax(§3.5), and the checklist(§8).

Code and Markdown snippets in this README demonstrate local syntax or placement rules unless they are explicitly described as a complete document set. A reader must not infer that omitted sibling sections, metadata, examples, or tables are optional in generated output.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Core Principles](#2-core-principles)
- [3. File Structure](#3-file-structure)
- [4. Operation Definition Format](#4-operation-definition-format)
- [5. Workflow Definitions](#5-workflow-definitions-workflows-optional)
- [6. Cross-Cutting Requirements and Writing Style](#6-cross-cutting-requirements-and-writing-style)
- [7. Relationship with AsyncAPI](#7-relationship-with-asyncapi)
- [8. Compliance Checklist](#8-compliance-checklist)

---

## 1. Overview

DocAI Messaging is a documentation format for describing message-driven APIs in a way that is optimized for **LLMs to understand and use**. AsyncAPI is intended for machine processing(code generation and validation) and human browsing. In contrast, DocAI Messaging has one purpose: **allow an LLM to load the documentation into context and write correct message-producing and message-consuming code on the first attempt**.

DocAI Messaging is designed to be **generated from one authoritative input set**(an AsyncAPI document, code annotations, pass-through convention or workflow content, or similar), not hand-maintained as duplicated output files. The format deliberately duplicates information for the LLM's benefit(see Core Principles), and that duplication is only safe to maintain when a generator produces it from that authoritative input set. **Hand-editing the duplicated parts of a generated DocAI Messaging set is discouraged**, because edits will drift between copies. `CONVENTIONS.md` and `workflows/` typically contain knowledge absent from the machine-readable source, so they may be hand-maintained — or maintained as inputs the generator passes through(the generator still stamps them).

This document defines only the **format rules**. It does not cover tools or generator implementations.

Terminology used throughout: the **generator**(also called the producer) is the tool that emits a DocAI Messaging document set from the authoritative source. A **reader** is any consumer of a generated set — an LLM loading it as context, or a validation tool. A **document set** is every file produced by one generation run. The **implemented application** is the application the reader is writing code for; every operation in the set is described from its viewpoint(§3, `perspective`).

### Why DocAI Messaging is needed instead of only AsyncAPI

AsyncAPI is difficult for LLMs to read for these reasons:

- Indirect references through `$ref` and reusable components — understanding one operation requires moving around the document, which adds expansion cost in context
- Deeply nested JSON/YAML — understanding the structure wastes tokens
- Examples are optional — LLMs learn more accurately from concrete examples than from schemas alone
- The viewpoint of `send`/`receive` is the documented application's, which may be the opposite of the application the reader is implementing — perspective inversion is a systematic source of LLM mistakes
- Delivery guarantees, ordering, redelivery, deduplication, acknowledgement policy, and failure handling have no standardized required fields, so their location and completeness vary by source — yet these are exactly the facts a messaging client gets wrong

DocAI Messaging reverses these tradeoffs: **no cross-file schema/object references, flat structure, required examples for representable non-empty payloads, a fixed perspective, and required delivery-behavior descriptions**. Cross-file links are allowed for navigation and context selection, such as `CONVENTIONS.md`, `Also read`, workflows, and source locations named by `**unsupported**:`. Common failure-shape labels are the only cross-file contract references: they may point from operation failure rows to `CONVENTIONS.md` because common failure handling is an API-wide convention, not a shared resource object.

## 2. Core Principles

1. **Self-contained with conventions** — An operation definition must be fully understandable when read together with its applicable `CONVENTIONS.md` sections. The normal read order is `INDEX.md` → applicable `CONVENTIONS.md` sections → the selected channel/workflow file. An INDEX may identify only the dependency-closed convention sections needed for an operation; when it does, the CONVENTIONS.md metadata stamp and those sections replace the whole file in the normal read order(§3.2). Even common schemas and shared domain objects(such as `Order`, `Money`, `Address`) must be expanded inline in each operation; within one channel file, the `compact` profile may replace a repeated semantically identical payload representation with a `**same_as**:` backward reference(§3.4). When `**same_as**:` is used, self-containment is guaranteed at the producer's intended retrieval-unit level, not necessarily at a single-operation chunk. Duplication is acceptable when it lowers the total context needed for a task. Whether duplication or reference resolution is cheaper must be measured against representative documents and target models rather than assumed. Consistency across duplicated copies is the **generator's responsibility**(§1); keeping them in sync by hand is discouraged. The only content factored out of operation definitions into another file is API-wide conventions, which live in CONVENTIONS.md(§3.3) — shared *objects* are not conventions and are still inlined.
2. **Example-first** — Every representable non-empty message payload must include realistic concrete examples. Field tables supplement examples with constraints and presence rules. A payload that cannot be emitted faithfully uses the explicit `unsupported` replacement form in §3.4 rather than a guessed example. Authoritatively established payload-less messages must explicitly say `none`; missing payload knowledge uses the `unknown` form in §3.4. In the `compact` profile, a later payload representation may use `**same_as**:` instead of repeating a semantically identical earlier representation in the same channel file.
3. **Markdown-based** — DocAI Messaging uses structured Markdown and fenced code blocks so that examples and implementation guidance remain readable to an LLM and a human. DocAI Messaging must not be a YAML/JSON-only definition file.
4. **Deterministic structure** — Section order, heading levels, and required section roles are fixed. All structural text — fixed headings, table column headers, canonical keys, markers, and fixed values — is written in English regardless of the document language(§4.1); only prose is written in the document language. An LLM should be able to predict where information exists just from knowing the DocAI Messaging format.
5. **Fixed perspective** — Every operation states what the implemented application does: `SEND` means the implemented application publishes/produces the message; `RECEIVE` means it consumes/handles the message. The generator resolves any perspective difference between the authoritative source and the implemented application(§7); the reader never inverts direction.
6. **Describe delivery behavior** — Delivery guarantees, ordering, redelivery, deduplication, acknowledgement policy, side effects, preconditions, and failure-time state cannot be inferred from payload schemas and must be required.
7. **Bounded channel files** — Group operations by channel or domain, but split a large file into task-oriented shards(such as `orders-send.md` and `orders-receive.md`) so that only the context needed for the task has to be loaded. Each operation appears in exactly one channel file.

## 3. File Structure

```
docs/
  INDEX.md          # Required: list of all operations, one-line summary each
  CONVENTIONS.md    # Required: API-wide messaging conventions
  channels/
    orders.md       # Operation definitions grouped by channel or domain
    payments.md
  workflows/
    order-cancellation.md  # Optional: message flows spanning multiple operations
```

Because files are loaded **individually**(that is the point of splitting), freshness cannot live only in INDEX.md. Every file — INDEX.md, CONVENTIONS.md, and each file under channels/ and workflows/ — must begin with a one-line metadata stamp so an LLM that loaded only that file can judge how current it is, whose viewpoint it uses, and how much detail it contains:

```markdown
> docai-messaging: 0.2.0 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | generated: 2026-07-27 | generation_id: full-20260727-abc123 | projection_id: 20260727-abc123 | source: asyncapi.yaml (AsyncAPI 3.0.0) | source_revision: sha256:abc123
```

The stamp is one Markdown blockquote line of `key: value` pairs separated by an unescaped ` | `. The standard keys from `docai-messaging` through `source` are required and appear in exactly the order shown above. `source_revision` is the only optional standard key; when no stable revision can be produced, omit the entire ` | source_revision: ...` pair rather than writing `none` or `unknown`. Parse each pair at its first `: `. Values must not contain a newline. Within a value, escape `\` as `\\` and `|` as `\|`; these are the only valid escape sequences. When locating separators, a pipe is escaped when it is immediately preceded by an odd-length run of backslashes. After splitting the pairs, decode escapes from left to right. An unknown escape or a trailing unescaped backslash makes the stamp invalid. Extension keys must use the `x-` prefix(§3.1) and come after the standard keys that are present; if `source_revision` is present they follow it, otherwise they follow `source`.

- `docai-messaging` is the DocAI Messaging format version in `major.minor.patch` form(§3.1).
- `profile` is `full` or `compact`(§3.4).
- `perspective` names the implemented application — the application whose viewpoint every `SEND` and `RECEIVE` action in the set uses. The reader writes code for this application. It must be identical in every file in the set.
- `coverage` is either `complete` or `requires-source`. In INDEX.md it describes the whole set; in every other file it describes that file. Use `requires-source` when the covered scope contains one or more `**unsupported**:` markers, and `complete` otherwise. Coverage reports projection completeness, not format compliance: both values are permitted in a compliant set.
- `knowledge` is either `complete` or `requires-input`. In INDEX.md it describes the whole set; in every other file it describes that file. Use `requires-input` when the covered scope contains one or more `**unknown**:` markers, and `complete` otherwise. Knowledge reports whether the authoritative inputs supply every required client-relevant fact; it is independent of whether DocAI Messaging can represent supplied facts. A reader must obtain the missing authoritative input before relying on the affected behavior.
- `generated` is the generation date in ISO 8601 `YYYY-MM-DD` form.
- `generation_id` identifies one complete generation run. It must be identical in every file in the set and different for every run.
- `projection_id` identifies the logical projection-input snapshot, including authoritative sources, pass-through content, perspective configuration, generator version, and configuration that can affect set content. It must be identical in every file generated from that snapshot and change whenever any such input changes.
- `source` is the source document(s) or source system(s) used to generate the file. Include the source specification and exact version when applicable, such as `asyncapi.yaml (AsyncAPI 3.0.0)`.
- `source_revision` is an opaque stable revision identifier covering the input(s) used to generate that file, including pass-through inputs when they are stamped by the generator. When it is a cryptographic content hash, prefix the value with the lowercase algorithm name, such as `sha256:abc123...`. Omit it only when no stable revision can be produced.

A document set is generated per profile and is always regenerated **as a whole**: one generation run re-stamps every file in that profile set with the same `generated` date, `generation_id`, `projection_id`, and `perspective`(`coverage`, `knowledge`, `source`, and `source_revision` may differ per file as defined above). Files with different `generation_id` values must not be treated as one consistent profile set. Matching full and compact sets share one projection snapshot and `projection_id` but use profile-specific `generation_id` values(§3.4). The date is informational and is not sufficient to establish set consistency.

**Format compliance and implementation readiness are different judgments.** A set is format-compliant when it satisfies this specification, including the required signaling of incomplete information. A format-compliant set is **implementation-ready** only when its INDEX.md has both `coverage: complete` and `knowledge: complete`. A set using `requires-source` or `requires-input` remains format-compliant but is not implementation-ready, and a reader must not treat compliance alone as permission to guess the missing contract. For task-scoped retrieval, a selected operation may still be **selected-operation-ready** when the selected INDEX row, the applicable loaded `CONVENTIONS.md` sections, the operation's channel retrieval unit, and relevant `Also read` files contain no `**unknown**:` or `**unsupported**:` marker for facts needed by that operation.

### 3.1 Format Versioning and Compatibility

DocAI Messaging uses semantic `major.minor.patch` versions with the same compatibility model as DocAI HTTP:

- `major` changes when an existing compliant document can change meaning, or when a reader must understand a new required structure to use the document correctly.
- From 1.0.0 onward, `minor` adds backward-compatible optional structures or capabilities. A reader must process a document with a newer minor version of a supported major version by ignoring optional structures it does not understand under the self-bounding rules below.
- `patch` clarifies wording or fixes examples without changing document meaning or required structure.

Before 1.0.0, the format is unstable: an incompatible draft change increments the minor version and resets patch to zero, while a compatible clarification increments patch. A pre-1.0 reader must reject a newer pre-1.0 minor version unless it explicitly supports that specific minor version; it may process newer patch versions of a supported pre-1.0 minor version. From 1.0.0 onward, the major/minor/patch rules above apply without this draft exception.

Normative requirement words have the following meanings throughout this specification, whether lowercase or uppercase: `must` / `required` means mandatory for compliance; `must not` means prohibited; `should` / `recommended` means there may be a valid reason to deviate, but the consequences must be understood; and `may` / `optional` means permitted but not required. In normative sections, imperative instructions such as `Use`, `Write`, `Include`, `Do not`, and `Omit` are normative with the corresponding `must` or `must not` force unless the surrounding text explicitly labels them advisory or non-normative.

A reader must reject an unsupported major version rather than guessing; for an LLM reader, rejecting means reporting the unsupported version instead of implementing against the document. It must ignore unknown metadata keys, sections, markers, or table columns whose names begin with `x-`(stamp key `x-team`, heading `#### x-Team Notes`, marker `**x-audit**:`, column `x-Internal`). From 1.0.0 onward, when a document declares a newer minor version of a supported major version, a reader must also ignore unknown standard optional structures that satisfy the self-bounding rules below. Producers must not place information required to use the messaging API correctly only in an `x-` extension or in a standard optional structure added in a minor version. A producer that emits unknown non-extension structural text not defined by its declared DocAI Messaging version creates a non-compliant document. Because Markdown headings are structural in DocAI Messaging, producers must not add ordinary non-standard headings inside standard sections; put required information in the standard section's prose, lists, or tables, and use an `x-` heading only for ignorable non-contract notes.

From 1.0.0 onward, a standard structure added in a minor version must be self-bounding so an older reader can skip it without interpreting its contents. It may be a metadata key, a final table column, a one-line marker whose complete value is on that line, or a heading exactly one level deeper than the standard section it extends whose content ends at the next heading of the same level or a shallower level. It must follow the affected section's previously defined required content and must not split or reorder that content. A new multi-line structure that cannot satisfy one of these boundaries, or information that an existing reader must understand to use the API correctly, requires a new major version.

Extensions must not disrupt the fixed standard structure. An `x-` metadata key follows all present standard stamp keys. An `x-` table column follows every standard column. An `x-` marker appears only after the required standard content in the standard section it extends. An `x-` heading is exactly one level deeper than the standard section it extends, appears after that section's required content, and ends before the next standard section. An extension must not replace, split, reorder, or change the meaning of standard content.

### 3.2 INDEX.md(required)

The entry point that an LLM reads first. Operations are listed under a fixed `## Operations` section, grouped into **one subsection per channel file**: a `###` heading whose text is the file's path from the docs root, followed by a table with one operation per row.

```markdown
> docai-messaging: 0.2.0 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | generated: 2026-07-27 | generation_id: full-20260727-abc123 | projection_id: 20260727-abc123 | source: asyncapi.yaml (AsyncAPI 3.0.0) | source_revision: sha256:abc123
Compact set: ../docs-compact/

# Messaging Index

## Operations

### channels/orders.md

| Action | Channel | Operation | Message | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|---|---|
| SEND | orders.commands | cancel-order | cancel-order | cancel order | Requests asynchronous cancellation; outcome arrives as a correlated reply | workflows/order-cancellation.md | Authentication, Delivery Semantics, Idempotency and Deduplication, Ordering, Request-Reply |
| RECEIVE | orders.events | on-order-shipped | order-shipped | track shipment | At-least-once delivery; deduplicate by `message_id` header | none | Delivery Semantics, Idempotency and Deduplication |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Order cancellation | Send the cancel command and confirm the outcome reply | workflows/order-cancellation.md |
```

- One operation per row. The `###` heading names the file to read, so the LLM picks a subsection, then a row. There is no per-row file column — the heading carries the path once.
- When a matching compact or full profile set exists, the INDEX profile-link line appears directly after the metadata stamp with the fixed label `Compact set:` in a full INDEX or `Full set:` in a compact INDEX, followed by the other root using the profile-link relative-directory grammar in §3.5. Omit the line when no matching optional compact set exists. A reader must not interpret an unknown `profile` value as `full`; it reports the unsupported profile unless it can follow a `Full set:` link and verify that the full INDEX has the same `projection_id`.
- `Operations` is always present. If the set exposes no operations, write `none` under it instead of adding channel subsections.
- `Action` is `SEND` or `RECEIVE`, from the implemented application's perspective(§4).
- `Channel` is the channel address exactly as it appears in the operation heading, including `{name}` parameters.
- `Operation` is the operation name exactly as it appears in the heading's ` (<operation name>)` suffix(§3.5). Because operation names are set-unique, this cell alone identifies the heading to load; `Action` and `Channel` support selection.
- `Message` lists the operation's message name(s). Separate multiple names in the same cell with `; `. A reply message documented inside the operation's `Reply` section is not listed here.
- `Task` contains one or more short client intent labels, each usually 1-3 words in languages that use spaces or a similarly short phrase in other languages. It helps an LLM avoid loading unrelated channel files. Reuse the exact same label for every operation that serves the same client task; operations serving different tasks get different labels. Do not invent synonyms for one task. When one operation serves multiple tasks, list every label in the same cell separated by `; `, put the primary task first, and do not use a semicolon inside a label. The operation still appears in exactly one INDEX row and one channel file.
- `Summary` must add information beyond `Task`(key behavior, delivery property, side effect, or distinguishing detail) — a summary that only restates the task label is non-compliant. Keep it to one short sentence.
- `Also read` lists extra docs-root-relative files that should usually be loaded for this operation, such as workflows. Separate multiple paths with commas. Write `none` when no extra file is normally needed.
- An INDEX in either profile may add the optional final `Conventions` column after `Also read`. Its value is a comma-separated list of exact level-two `CONVENTIONS.md` heading text without `## `, `all`, or `none`; values are matched case-sensitively. The list must include every convention section needed by the operation and every section needed to interpret another listed section. Omit the column or write `all` unless the producer can prove that this dependency-closed set preserves the complete applicable contract. A reader that does not see or trust the column, or sees `all`, loads all of CONVENTIONS.md. A trusted `none` value loads only the CONVENTIONS.md metadata stamp. Ignoring the column and loading the whole file remains correct. Emit the column only when measured retrieval savings exceed its INDEX token cost for the target model and retrieval flow.
- `Workflows` is always present after `Operations`. If workflow files exist, list all of them in the table; otherwise write `none` under the heading.
- When one or more authoritative source operations cannot be emitted as normal routing rows, add the optional fixed `## Unprojected Operations` section after `Workflows`. Omit the section when every source operation is projected. Write one canonical one-line marker per omitted operation: `**unsupported**: localized: source operation <source identifier, derived name, or exact current source location>: <unrepresentable action or address and source location>` when the routing fact is known but unrepresentable, or `**unknown**: source operation <source identifier, derived name, or exact current source location>: <missing action or address and expected authoritative input or source location>` when the routing fact is absent. A current source location may identify the marker even when it is not stable enough to derive a routing name. These markers participate in INDEX coverage and knowledge exactly like markers in projected files. Unprojected operations must not appear as incomplete normal `Operations` rows.

### 3.3 CONVENTIONS.md(required)

Write API-wide messaging conventions in **one place only**. This is the only cross-file exception that allows repetition to be removed from operation definitions. Use the following fixed headings in this order; write `none` under a heading that does not apply:

- `# Messaging Conventions`
- `## Environments` — Brokers/servers per environment: protocol, host, port, virtual host or namespace, and how the client selects one
- `## Protocols and Bindings` — Protocol versions and API-wide binding conventions(client library expectations, TLS requirements, protocol-level defaults)
- `## Authentication` — Authentication method(SASL mechanism, token, mTLS, API key), credential acquisition and rotation, and concrete examples(credential values in examples must be clearly fake placeholders, §6)
- `## Connection and Session` — Connection setup, reconnection and backoff, heartbeats/keep-alive, session or consumer-group conventions, prefetch/flow-control defaults
- `## Serialization` — Payload media types, character encodings, schema registry usage(subjects, versions, compatibility mode), and how the wire format is selected
- `## Message Envelope` — Standard headers or envelope fields every message carries(message ID, event type, timestamps, tracing); operations document only operation-specific headers beyond this envelope
- `## Delivery Semantics` — Default delivery guarantee(at-most-once, at-least-once, exactly-once), acknowledgement policy(when to ack/nack, deadlines), redelivery behavior, and persistence
- `## Idempotency and Deduplication` — The API-wide deduplication key and how consumers must deduplicate; producer idempotency conventions
- `## Ordering` — Default ordering scope(per key, per partition, per queue, none) and what consumers may assume
- `## Error Handling` — Dead-letter channels, retry channels/policies, poison-message handling, common failure-signal message shapes shared by operations
- `## Request-Reply` — API-wide correlation convention(correlation header, reply-channel selection), default timeouts, and timeout handling
- `## Schema Evolution` — How payload schemas evolve and what consumers must tolerate(for example, ignore unknown fields), and how breaking changes are announced(new channel, version suffix)
- `## Data Representation` — Datetime, IDs, money, and other representation rules, including an API-wide object-openness default when established
- `## Empty and Omitted Values` — Handling of `null`, empty arrays, empty objects, empty strings, and omitted fields
- `## Rate Limits and Quotas` — Publish rate limits, quota errors, throttling signals, and required client behavior

When `Error Handling` defines common failure-signal message shapes shared by operations, define each shape once as a `**message_shape**:` block so operation failure rows can reference it with `common:<label>`(§4.1). A shape label uses lowercase ASCII letters, digits, `_`, and `-`, starts with a letter, and is unique across the set. Each block contains, in order: `**message_shape**: <label>`, the shape's headers content(a `#### Headers` table or the collapsed line `- Headers: none`), its message-scoped bindings content(a `#### Bindings` table or `- Bindings: none`), then a `#### Payload` heading containing the receive-side payload rules of §4.1(`**payload_presence**:`, representations, examples, and field tables with `Presence` semantics), or `none` for a payload-less shape:

````markdown
**message_shape**: dead-letter

#### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| x-original-channel | string | always | no | Channel the message was consumed from |
| x-error | string | always | no | Machine-readable failure code(`deserialization_failed`, `handler_error`, `retries_exhausted`) |

#### Bindings

none

#### Payload

**payload_presence**: always

**media_type**: application/json

**payload_nullable**: no

```json
{"message_id":"msg_01HXYZ","channel":"orders.commands","error":"handler_error","received_at":"2026-07-27T09:30:05Z"}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| message_id | string | always | no | `message_id` header of the original message; use it to locate the failed message |
| channel | string | always | no | Original channel address |
| error | string | always | no | Same code as the `x-error` header |
| received_at | string | always | no | RFC 3339 timestamp of the failed processing attempt |
````

For every convention heading, write `none` only when the authoritative inputs affirm that the convention does not apply. If the entire convention heading's applicability or content is not established, use the whole-section form: write `unknown` under that heading, immediately followed by `**unknown**: <missing fact and expected authoritative input or source location>`, and apply `knowledge: requires-input`(§3.4). If only one fact inside an otherwise established convention is missing, emit the established required content, then add the `**unknown**:` marker after the affected content as defined in §3.4.

Each operation definition and workflow file implicitly follows `CONVENTIONS.md`. Only deviations must be described in the file itself, inside the section they affect and prefixed with the fixed marker `**deviation**:`(§4.1) so an LLM can locate them.

Operation-local `none` values do not cancel API-wide conventions. For message headers, delivery semantics, failure handling, authentication, and other shared rules, `none` in an operation section means there is no operation-specific addition in that section; applicable rules in `CONVENTIONS.md` still apply unless the operation states a `**deviation**:`.

### 3.4 Output Profiles and Incomplete Information

DocAI Messaging 0.2.0 defines a required `full` profile and an optional `compact` profile. Every compliant projection snapshot has a full set. A producer may additionally generate a compact set from the same authoritative inputs and projection-input snapshot; a compact-only projection is non-compliant because intentionally reduced content would have no canonical expanded fallback.

- `full` is the canonical detailed projection. It preserves all source information needed for the implemented application to construct, send, receive, and handle messages correctly when that information is representable in DocAI Messaging. It is not a lossless serialization of the source schema.
- `compact` is the LLM runtime projection. It preserves the same complete client-visible contract but may use only the measured, reconstructable reductions defined below.

The two profile sets live in separate roots(for example, full in `docs/` and compact in `docs-compact/`) and contain the same standard docs-root-relative paths for INDEX.md, CONVENTIONS.md, and every channel and workflow file. They share one `projection_id` and perspective. Corresponding files cover the same source scope and therefore have identical `coverage` and `knowledge`; compact reductions never hide an unsupported feature or missing fact. Each profile set has its own `generation_id` and is internally regenerated as a whole. The INDEX profile-link line defined in §3.2 makes the matching root discoverable. A reader must verify the same `projection_id` before consulting or combining paired sets.

A reader must not interpret an unknown profile as `full`. It reports the unsupported profile unless the unknown-profile INDEX provides a `Full set:` link whose target uses a supported full profile with the same `projection_id`; in that case it uses the full set. This fallback rule is part of the 0.2 contract so a future optional runtime profile can remain safely ignorable after 1.0.

The compact profile may apply these reductions:

- Render a structured example on one line when the exact decoded value is unchanged and the result remains readable. Pretty-print when line breaks materially help distinguish nesting, variants, or wire semantics.
- Use the optional one-line marker `**field_defaults**: <column>=<value>` immediately before a compact header or payload-field table to omit one or more uniform columns. Separate multiple defaults with ` | `. Valid defaults are `Required=yes|no`, `Presence=always`, `Nullable=yes|no`, and `Meaning=none`. `Meaning=none` applies only when the full table's final column is exactly `Meaning` and every omitted cell would be empty. A default is valid only when the named column exists in the table's full-profile form and every row has that value. `Required=conditional`, conditional Presence, and any column containing `unknown` cannot be defaulted. Reconstruct the logical full-profile columns in their standard positions before applying any other validation rule. Emit the marker only when the marker plus shorter table costs fewer measured tokens than the unreduced table.
- Within one compact channel file, replace a later semantically identical payload representation with a direct backward `**same_as**:` reference to an earlier expanded representation. The two exact forms are `**same_as**: Operation <operation-name> Message <message-name> Payload <media-type>` and `**same_as**: Operation <operation-name> Reply Message <message-name> Payload <media-type>`. The first targets a primary message and the second a reply message. The target operation name is set-unique, the target message name is unique within that operation including reply messages, and the media type identifies the representation.

A `**same_as**:` line replaces that representation's `**media_type**:`, `**payload_nullable**:`, example, field table, variants, and representation-specific prose. The containing send-side `**payload_required**:` or receive-side `**payload_presence**:` remains because whole-message payload omission may differ even when the representation is identical. A same-as target must:

- precede the reference in the same compact channel file and be an expanded representation, not another `**same_as**:` line;
- use the same Required or Presence table semantics as the referring representation;
- have identical concrete media type, payload nullability, field types, requiredness or presence, field nullability, constraints, meanings, variants, and wire semantics; and
- have an example that remains valid and contextually accurate for the referring message without changing its value; and
- not use an unknown media type or be raw binary, recursive, unsupported, or otherwise incomplete.

Cross-file same-as references are prohibited, and failure-signal message shapes must not use `**same_as**:`. When a channel file contains same-as references, the producer's intended retrieval unit must include both the target and the reference. Expose that unit to the intended reader or retrieval tool through ignorable metadata such as `x-retrieval-unit: channel-file` after the standard stamp keys, or equivalent published retrieval configuration. If the reader normally retrieves smaller chunks and cannot guarantee the unit, duplicate the representation. Emit `**same_as**:` only when the reference plus retrieval cost is smaller than the duplicated representation for the measured target flow.

The full profile never uses `**field_defaults**:` or `**same_as**:` and emits every required column and representation in expanded form.

These compact-only snippets demonstrate the two structural reductions:

```markdown
**field_defaults**: Required=yes | Nullable=no

| Field | Type | Constraints / Meaning |
|---|---|---|
| order_id | string | ULID with `ord_` prefix |
| requested_at | string | RFC 3339 timestamp |
```

```markdown
#### Payload

**payload_required**: yes

**same_as**: Operation create-order Message order-command Payload application/json
```

DocAI Messaging 0.2.0 has no dedicated structure for the connection-scoped contracts of connection-oriented protocols such as WebSocket — connection handshakes, subscription lifecycles(subscribe, receive a snapshot, then receive deltas), and reconnection/resynchronization rules. Document them in `CONVENTIONS.md` `Connection and Session` when they are API-wide, and as workflows(§5) when they span multiple operations in a required order. A future minor version may add dedicated self-bounding structures for connection lifecycles under the compatibility rules of §3.1; keeping this content in the two locations above is what allows that migration without a breaking change. Producers must not invent non-standard headings or markers for connection lifecycles in the meantime.

DocAI Messaging is a client-implementation projection, not a replacement serialization for AsyncAPI or its schema formats. When a source feature that affects client correctness cannot be represented faithfully, the generator must place a canonical `**unsupported**:` marker inside the affected section, set that file's `coverage` to `requires-source`, and set INDEX.md coverage to `requires-source`. It must not silently approximate or omit that feature. Such a file may be format-compliant, but it is not a complete projection and an LLM must consult the authoritative source before implementing the affected operation.

An `**unsupported**:` marker has one of two canonical value prefixes and placements:

- **Localized unsupported feature** — Use `**unsupported**: localized: <exact feature, scope, and source location>`. When the enclosing required content can still be represented faithfully, emit that required content and put the marker immediately after the smallest table, representation, marker group, or prose block affected by the omitted feature. The emitted content must not approximate the unsupported part. This marker is a one-line warning and does not begin a new representation.
- **Replacement form** — Use `**unsupported**: replaces <unit>: <exact feature and source location>`. When a required content unit cannot be emitted at all without approximating the source, this single marker replaces the normal contents of the smallest affected unit. The unit's standard heading and any independently known operation-level marker remain present(for a non-empty payload, retain `**payload_required**:` or `**payload_presence**:` when its value is representable). A reader must not infer any replaced fact. Other representable sibling units remain fully documented.

The replacement `<unit>` value must use one of these canonical forms:

- `Operation Bindings` for the operation-scoped bindings section.
- `channel Parameters` or `channel Bindings` for a whole Channel subsection.
- `Message <name>` for one complete message section.
- `message Headers <name>`, `message Bindings <name>`, or `message Payload <name>` for one message's headers, bindings, or payload content.
- `payload representation <name> <media type>` for one payload representation.
- `Reply` for the whole reply section; `reply channel Parameters` or `reply channel Bindings` for the reply Channel subsections; `reply Message <name>` for one reply message; or `reply message Headers <name>`, `reply message Bindings <name>`, or `reply message Payload <name>` for one reply message unit.
- `Failure Handling` for the operation failure section, or `failure shape <label>` for one common or inline failure shape.
- `CONVENTIONS <heading>` for one `CONVENTIONS.md` level-two heading, using the exact heading text without `## `.
- `workflow Preconditions`, `workflow Steps`, `workflow State Transitions`, or `workflow Failure and Recovery` for one workflow section.

Missing authoritative knowledge is different from an unrepresentable source feature. When a fact required by DocAI Messaging is absent from all authoritative inputs, the generator must put `unknown` in the affected canonical value or prose location and add `**unknown**: <missing fact and expected authoritative input or source location>` inside the smallest affected standard section. For constrained marker values or table cells, `unknown` is the canonical value when that specific fact is missing; this includes `**payload_required**: unknown`, `**payload_presence**: unknown`, `**payload_nullable**: unknown`, `**media_type**: unknown`, `Required=unknown`, `Presence=unknown`, `Nullable=unknown`, and `Type=unknown`. A compact table must not default a column containing `unknown`. A standard section or subsection for which this specification permits the complete content `none` may instead contain `unknown` followed immediately by its `**unknown**:` marker when none of that section's content is established. Otherwise, the marker follows the affected section's required standard content and does not by itself replace a required key, table, example, or representation. Multiple unknown cells in one table may share one `**unknown**:` marker immediately after that table, but the marker must identify the affected column(s), row names, missing facts, and expected authoritative input. Set that file's `knowledge` to `requires-input` and set INDEX.md knowledge to `requires-input`. A reader must not interpret `unknown` as `none`, invent the fact, or assume a safe default. It must obtain the named input or report that implementation of the affected behavior is blocked. `coverage` and `knowledge` are independent: a file may simultaneously contain `**unsupported**:` and `**unknown**:`.

Do not use `unknown` for structural identifiers whose grammar is needed to locate or bound content: operation action, channel address, operation name, message name, file path, table column header, header/field/parameter name, `**message_shape**:` label, `common:<label>`, `inline:<label>`, `**same_as**:` target, or replacement `**unsupported**:` unit name. If one of those identifiers, other than operation action, channel address, or operation name, is missing and the affected unit cannot otherwise be emitted with a valid derived identifier, use the smallest applicable whole-section `unknown` form. Missing source operation and message identifiers are not blocking when the stable source identity required by §3.5 exists: the generator derives their names. Operation action, channel address, and operation name are the normal operation heading and INDEX routing keys; if the action or address is absent or unrepresentable, do not emit a normal operation row or definition. Instead, add that source operation to INDEX `Unprojected Operations` with the canonical `**unknown**:` or localized `**unsupported**:` form from §3.2. This rule prevents an omitted source operation from being hidden behind `coverage: complete` or `knowledge: complete`.

DocAI Messaging 0.2.0 has no recursive-schema reference syntax. Directly or indirectly recursive payload, header, or parameter shapes are deliberately outside the 0.2.0 representable scope. The generator must use the smallest applicable localized or replacement `**unsupported**:` form and apply `coverage: requires-source`; it must not truncate the recursion at an arbitrary depth or invent a non-recursive shape. Expanding a recursive shape to an arbitrary finite depth would make the generated document appear complete while hiding deeper valid values from the LLM.

### 3.5 Canonical Syntax and Boundaries

DocAI Messaging remains readable Markdown, but structural constructs have deterministic boundaries:

- Structural text consists of metadata stamp and INDEX profile-link lines; Markdown headings; standard tables and their column headers; bold markers whose line has the form `**name**: value`; collapsed fixed `none` list items; Behavior and Reply key list items; and fixed values. Other sentences, list items, code blocks, and free-text table cells are prose unless their enclosing rule assigns them a structural role. Standard variable headings whose grammar is defined by this specification — operation headings `## <ACTION> <address> (<operation name>)`, INDEX channel headings `### <channel file path>`, message headings `### Message <name>`, reply message headings `#### Message <name>`, and workflow title headings `# <workflow name>` — are not unknown structural text merely because their values vary.
- A standard section begins at its fixed heading and ends at the next heading of the same level or a shallower level(a numerically equal or lower heading level). A one-line marker ends at its newline unless its rule explicitly introduces the example, table, or variant blocks that follow. An expanded payload representation begins at `**media_type**:`; a compact reused representation begins at `**same_as**:`; and an unsupported replacement representation begins at an `**unsupported**:` marker whose value begins with `replaces ` and names that representation. Each ends at the next representation marker or a heading that ends the enclosing payload section. A `**field_defaults**:` marker applies only to the immediately following standard table. A `**message_shape**:` block ends at the next `**message_shape**:` marker or a heading of the enclosing section's level or shallower. A variant begins at `**variant**:` and ends at the next variant or representation marker or the enclosing payload boundary.
- An operation heading is `## <ACTION> <address> (<operation name>)`. `ACTION` is `SEND` or `RECEIVE`. The address is a non-empty channel address with no ASCII whitespace, using `{name}` for each address parameter; a parameter name must be non-empty and must not contain `/`, `{`, `}`, or ASCII whitespace. Literal `{` or `}` characters outside parameter delimiters cannot be represented. The operation name is required, matches `[A-Za-z0-9._-]+`, and is unique within the set, so the complete heading text is also unique and stable across regenerations. When the authoritative source defines a set-unique operation identifier that fits this grammar, use it unchanged. Otherwise derive the operation name under the stable-name algorithm below. If a source address cannot be represented by this grammar, do not normalize it silently; use INDEX `Unprojected Operations` under §3.2 and §3.4.
- A message name matches `[A-Za-z0-9._-]+` and is unique within its operation, including its reply messages. When a source message identifier fits this grammar and is unique in that scope, use it unchanged; otherwise derive the message name under the stable-name algorithm below.
- A derived operation name is `op-` followed by all 64 lowercase hexadecimal digits of SHA-256. A derived message name is `msg-` followed by all 64 lowercase hexadecimal digits. The hash input is the concatenation of four length-prefixed UTF-8 components. Encode each component as its decimal UTF-8 byte length with no leading zero, one ASCII `:`, and the exact component bytes: `<length>:<source-kind><length>:<source-document-identity><length>:<source-location><length>:<local-kind>`.
- For the stable-name hash, `source-kind` is the exact lowercase authoritative-format or adapter identifier(such as `asyncapi-3.0`); `source-document-identity` is the stable source URI, repository-relative source path, or source-system namespace fixed by projection configuration; and `source-location` is the format-native stable location(such as an RFC 6901 JSON Pointer) or an adapter-provided stable opaque object identifier. `local-kind` is `operation`, `message:primary:<containing-operation-source-location>`, or `message:reply:<containing-operation-source-location>`. These values and the adapter identity are part of the projection-input snapshot. They must not depend on traversal order, channel-file sharding, prose language, generated examples, generation time, or generated output. Do not use an array index that changes solely when an unrelated sibling is inserted unless that index is the authoritative format's stable identity. If stable source-document identity and location do not exist, use the unprojected operation or whole-message unknown form in §3.4 instead of inventing a name.
- A media type is a valid media type written in lowercase type and subtype, except that `**media_type**:` may use the literal value `unknown` under §3.4. Do not add optional whitespace around parameters, and use one exact spelling consistently wherever the same concrete media type appears. Retain parameters only when they affect construction or interpretation.
- A docs-root-relative file path uses `/` separators and one or more ASCII segments matching `[A-Za-z0-9._-]+`. It must not start with `/`, contain an empty, `.` or `..` segment, use `\`, or contain a query or fragment. An INDEX profile-link path is instead a relative directory path from the current INDEX location: it may begin with one or more `../` prefixes followed by one or more segments using the same ASCII grammar, and it ends with `/`; it must not be absolute, contain `.` segments, use `\`, or contain a query or fragment.
- A table begins at its header row and ends at the first non-table line. Standard tables are parsed from the Markdown source, not from rendered HTML. Each table row must be a pipe-table row whose first non-space character is `|` and whose final non-space character is `|`. A pipe is escaped exactly when it is immediately preceded by an odd-length run of backslashes; split cells on every other pipe. At table level `\|` represents a literal pipe inside the cell. The separator row(`|---|...|`) is required and determines the column count together with the header row. Every body row must have the same cell count after splitting.
- For structural comparison of table cells, first split the row, remove the outer boundary cells created by the leading and trailing pipes, trim leading and trailing ASCII spaces from each cell, then decode only table-level escaped pipes(`\|` to `|`). Do not decode HTML entities, interpret Markdown emphasis, or remove code-span backticks for structural values. Producers should not use Markdown formatting around structural cell values that must match elsewhere, such as header names, message names, shape labels, and file paths.
- Field paths use the same grammar and escapes as DocAI HTTP: dot notation for nested objects(`address.city`), `[]` for arrays(`items[].id`), `{key}` for dynamic-key map values, and the fixed root name `$` for a whole payload whose root is a scalar, array, or dynamic-key map. In a field-name segment, prefix each literal `\`, `.`, `[`, `]`, `{`, `}`, or `$` character with `\`; a literal `|` is written `\|` for table parsing. An empty property name or one containing CR or LF cannot be represented and must use the smallest applicable `**unsupported**:` form.
- Types use the simple grammar: the scalars `string` / `int` / `float` / `bool` / `null` / `any`; `object`; nestable arrays `T[]`; and nestable dynamic-key maps `map<string, T>`. No other Type syntax is valid; put enum values, formats such as RFC 3339, and semantic constraints in the constraints or meaning column, not in `Type`. Use `null` only when the authoritative source requires the decoded value at that position to be exactly `null`(the row must have `Nullable=yes`). Use `any` only when the authoritative source explicitly permits any decoded value; it is not a substitute for missing type knowledge — use `Type=unknown` with its required marker instead. Reference notation such as `$ref` is prohibited. These nestable type expressions do not define recursive schemas; recursive shapes follow §3.4.
- A fenced example or sample begins and ends at its Markdown fence. These boundaries, heading levels, fixed order, marker order, table parsing, and cell normalization rules are the basis for validation; visual Markdown rendering is not.

## 4. Operation Definition Format

In a channel file, define each operation using the following template. A channel file begins with the metadata stamp and then one or more operation definitions; do not add a file-level title or prose wrapper. **Section order, heading levels, and section roles are fixed**: purpose description and optional operation markers, `Behavior`, `Operation Bindings`, `Channel`, one or more `Message <name>` sections, `Reply`, `Failure Handling`, then `Related`. Do not omit required sections. In an operation-local section that supplements CONVENTIONS.md, `none` means there is no operation-local addition and applicable conventions still apply. In a section whose local rule says `none` means that the contract unit does not exist(such as a payload-less Message or an operation with no Reply), use it only when authoritative inputs establish that absence. Use the `unknown` form in §3.4 when applicability or content is not established.

````markdown
## SEND orders.commands (cancel-order)

Requests asynchronous cancellation of an order. The outcome arrives as a correlated reply message, not as a return value.

### Behavior

- side_effects: consumers cancel the order, release reserved inventory, and refund the captured payment
- idempotency: not idempotent by payload; set a unique `message_id` header and reuse the same value when resending so consumers can deduplicate
- preconditions: the order exists(created through the Orders HTTP API; see Related)
- authorization: producer credentials must hold the `orders:write` ACL for the `orders.commands.v1` topic
- delivery: at-least-once -- the publish is acknowledged only after broker replication. Treat a publish timeout as unknown outcome and resend with the same `message_id`
- ordering: messages with the same Kafka key are delivered to consumers in publish order; there is no ordering across keys

### Operation Bindings

none

### Channel

#### Parameters

none

#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `orders.commands.v1` |

### Message cancel-order

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| message_id | string | yes | no | ULID with `msg_` prefix, unique per logical command; reuse on resend for deduplication |
| type | string | yes | no | Always `order.cancel` |

#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the `order_id` payload field; required so cancellation and later commands for one order stay ordered |

#### Payload

**payload_required**: yes

**media_type**: application/json

**payload_nullable**: no

```json
{
  "order_id": "ord_01HXYZ",
  "reason": "customer_request",
  "requested_at": "2026-07-27T09:30:00Z"
}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties forbidden |
| order_id | string | yes | no | ULID with `ord_` prefix returned by order creation |
| reason | string | yes | no | `customer_request` \| `fraud_suspected` \| `out_of_stock` |
| requested_at | string | yes | no | RFC 3339 timestamp of the cancellation request |

### Reply

- channel: orders.replies
- correlation: the reply's `correlation_id` header equals the request's `message_id` header
- timeout: 30s; on timeout, resend with the same `message_id` or report the cancellation as unresolved. Do not invent an outcome

#### Channel

##### Parameters

none

##### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `orders.replies.v1` |

#### Message cancel-order-reply

##### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| correlation_id | string | always | no | Equals the `message_id` header of the request |
| type | string | always | no | Always `order.cancel.reply` |

##### Bindings

none

##### Payload

**payload_presence**: always

**media_type**: application/json

**payload_nullable**: no

```json
{
  "order_id": "ord_01HXYZ",
  "status": "cancelled",
  "processed_at": "2026-07-27T09:30:02Z"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties forbidden |
| order_id | string | always | no | Order the reply refers to |
| status | string | always | no | `cancelled` \| `rejected` |
| rejection_reason | string | when `status` is `rejected` | no | `already_shipped` \| `already_cancelled`; safe to show to users |
| processed_at | string | always | no | RFC 3339 processing timestamp |

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| publish rejected | broker error on publish | credentials lack the topic ACL or the topic does not exist | Do not retry with the same configuration; fix credentials or environment selection |
| reply timeout | no correlated reply within 30s | consumer backlog or consumer crash | Resend with the same `message_id`; consumers deduplicate. Escalate after 3 attempts |
| cancellation rejected | reply with `status` = `rejected` | the order is not cancellable | Do not resend; surface `rejection_reason` to the user |

### Related

- Order creation: POST /orders in the Orders HTTP API DocAI set
- Workflow: workflows/order-cancellation.md
````

### 4.1 Section Rules

**Heading(`## <ACTION> <address> (<operation name>)`)**
- `ACTION` is `SEND` when the implemented application produces the message and `RECEIVE` when it consumes the message. Use the heading grammar of §3.5: the address uses `{name}` for address parameters, and the ` (<operation name>)` suffix is always present, carrying the set-unique operation name.
- Except for the optional deprecation marker described below, write 1-2 sentences immediately after the heading describing why this operation is used. Describe the purpose, not the implementation.
- If the operation is deprecated, put a `**deprecated**: <replacement operation and migration>` line immediately after the heading, before the description, and prefix its INDEX.md summary with `(deprecated)`. Omit the line entirely otherwise.

**Behavior(required)**
- Use these **six canonical keys in this order** so an LLM and validation tools can always locate each fact: `side_effects`, `idempotency`, `preconditions`, `authorization`, `delivery`, `ordering`. `none` means there is no operation-specific fact beyond the applicable `CONVENTIONS.md` conventions; it does not mean that an inherited convention is inapplicable.
- All structural text is always written in English, even when generated prose is written in another language. Structural text is: the INDEX profile-link labels `Full set` / `Compact set`; every fixed heading this format defines(`Messaging Index`, `Operations`, `Workflows`, `Unprojected Operations`, `Messaging Conventions`, the §3.3 convention headings, `Behavior`, `Operation Bindings`, `Channel`, `Parameters`, `Bindings`, `Headers`, `Payload`, `Reply`, `Failure Handling`, `Related`, `Preconditions`, `Steps`, `State Transitions`, `Failure and Recovery`); the standard variable heading prefixes `Message `; every table column header(`Action` / `Channel` / `Operation` / `Message` / `Task` / `Summary` / `Also read` / `Conventions` / `Name` / `Details` / `Field` / `Type` / `Required` / `Presence` / `Nullable` / `Constraints / Meaning` / `Meaning` / `Protocol` / `Property` / `Value / Rule` / `Failure` / `Signal` / `Condition` / `From` / `Trigger` / `To`); the Behavior keys `side_effects` / `idempotency` / `preconditions` / `authorization` / `delivery` / `ordering`; the Reply keys `channel` / `correlation` / `timeout`; the markers `**deprecated**:`, `**deviation**:`, `**payload_required**:`, `**payload_presence**:`, `**payload_nullable**:`, `**media_type**:`, `**variant**:`, `**message_shape**:`, `**field_defaults**:`, `**same_as**:`, `**unknown**:`, and `**unsupported**:`; the `unsupported` value prefixes `localized:` and `replaces <unit>:`; the same-as fixed tokens `Operation` / `Message` / `Reply Message` / `Payload`; the failure-shape reference prefixes `common:` and `inline:`; the `(deprecated)` summary prefix; the actions `SEND` / `RECEIVE`; the delivery guarantee tokens `at-most-once` / `at-least-once` / `exactly-once`; the ASCII value separator ` -- ` that follows `dynamic` and a delivery guarantee token; the fixed root field name `$`; the fixed values `none` / `unknown` / `all` / `dynamic` / `yes` / `no` / `conditional` / `always` / `full` / `compact` / `complete` / `requires-source` / `requires-input` and the simple type names including `null`; and the metadata stamp keys `docai-messaging` / `profile` / `perspective` / `coverage` / `knowledge` / `generated` / `generation_id` / `projection_id` / `source` / `source_revision`. Only prose — descriptions, summaries, and free-text cells such as conditions, constraints, and meanings — is written in the document language(§6).
- `side_effects`: for SEND, what processing the message triggers; for RECEIVE, what the implemented application's handler is expected to do, including effects the sender relies on.
- `idempotency`: for SEND, whether resending is safe and which deduplication key to set; for RECEIVE, whether redelivery can occur and how the handler must deduplicate(the key and the required behavior on a duplicate).
- `preconditions`: earlier operations or API calls that must have happened, required resource state, required subscriptions.
- `authorization`: required credentials, ACLs, scopes, or roles for this operation's channel.
- `delivery`: the delivery guarantee and acknowledgement contract for this operation. A non-`none`, non-`unknown` value must begin with exactly one canonical guarantee token(`at-most-once`, `at-least-once`, or `exactly-once`), optionally followed by the ASCII separator ` -- ` and prose stating the operation-specific contract: for SEND, when a publish is considered durable and what an ambiguous outcome(timeout) means; for RECEIVE, when to acknowledge relative to processing, negative-acknowledgement behavior, and redelivery timing. An `exactly-once` token must always be followed by ` -- ` and the exact scope and conditions under which the guarantee holds(for example, a transaction boundary), because unqualified exactly-once claims are usually conditional. The token states the guarantee from the implemented application's perspective for this operation; details fully established by `CONVENTIONS.md` `Delivery Semantics` need not be repeated after the token.
- `ordering`: what ordering the implemented application may rely on or must preserve, and its exact scope(per key, per partition, per queue, none).
- These facts frequently have no standardized required fields in AsyncAPI. A source may still carry them in descriptions, bindings, extensions, annotations, or another input to the generator. Write `none` only when the authoritative inputs establish that there is no operation-specific addition beyond applicable conventions. When an authoritative input does not establish a required Behavior fact, write `unknown` as that key's value, add a `**unknown**:` marker after all six Behavior keys, and apply the `knowledge: requires-input` rules of §3.4. Do not infer `none` from an absent AsyncAPI field or description.

**Operation Bindings(required)**
- This section contains only operation-scoped protocol bindings, after source traits and references have been resolved. Use a `Protocol | Property | Value / Rule` table. Property names use the protocol binding's own vocabulary, and `Value / Rule` gives the exact client configuration with a concrete example when it is derived.
- Write `none` when there is no operation-specific binding beyond API-wide conventions. Use the whole-section unknown or replacement `unsupported` form from §3.4 when the applicable operation binding facts are missing or unrepresentable. Server-wide bindings stay in `CONVENTIONS.md`; channel- and message-scoped bindings stay in their respective sections.

**Channel(required)**
- The Channel section carries the facts needed to address the channel: `#### Parameters` then `#### Bindings`, in that order. Leading subsections whose entire content is `none` may drop the `####` heading and be written as one-line list items(`- Parameters: none`) directly under `### Channel`, keeping the fixed order; after the first non-empty `####` subsection, later empty subsections retain their heading and contain `none`.
- Every `{name}` parameter in the operation heading's address must have exactly one matching row in `Parameters`, and `Parameters` must not contain names absent from the address. Parameter tables use the columns `Name | Type | Constraints / Meaning` — address parameters are always required. State how each parameter value is obtained(for example, from a resource ID returned by an earlier call).
- `Bindings` is a table with the columns `Protocol | Property | Value / Rule`. Document only channel-scoped protocol facts the implemented application needs to address or configure this channel correctly: topic/exchange/queue names, queue properties the client must assert, and other channel binding properties. Property names are the protocol's own vocabulary; the `Value / Rule` cell gives the exact value or derivation rule with a concrete example. Write `none` when there is no channel-specific binding beyond applicable conventions.
- If the operation uses a broker, server, or environment different from `CONVENTIONS.md` `Environments`, put a `**deviation**:` line directly under `### Channel`, before the subsections, and give the exact selection rule.

**Message sections(one or more required)**
- Each message the operation sends or receives is one `### Message <name>` section containing `#### Headers`, `#### Bindings`, then `#### Payload`, in that order. The message name follows §3.5 and uses the authoritative source's message name when it is valid and unique in the required scope.
- When an operation has more than one Message section, begin each section with 1-2 sentences stating exactly when that message applies(the selection rule: a header value, a payload discriminator, or another observable fact). Order Message sections by message name in lexical order. A reader must be able to select or construct the correct message without relying on file context alone.
- Direction determines table semantics. In a `SEND` operation, the implemented application constructs the message: header tables use `Name | Type | Required | Nullable | Constraints / Meaning` and payload field tables use `Field | Type | Required | Nullable | Constraints / Meaning`. In a `RECEIVE` operation, the implemented application observes the message: header tables use `Name | Type | Presence | Nullable | Meaning` and payload field tables use `Field | Type | Presence | Nullable | Meaning`. Reply messages use the direction opposite to the operation's action.
- `Required` is `yes`, `no`, `conditional`, or `unknown`. A `conditional` row must state the exact condition in `Constraints / Meaning`. `Presence` is `always`, `unknown`, or the exact condition under which the header or field is present; do not use bare `conditional` as a Presence value. For nested fields, Presence is evaluated when the payload and every ancestor container field are present. `Nullable` is `yes`, `no`, or `unknown` and states whether the present decoded value may be `null`. Every `unknown` cell requires the marker and knowledge state from §3.4.
- `Headers` documents operation-specific message/application headers beyond the API-wide envelope in `CONVENTIONS.md` `Message Envelope`. Write `none` when there are no operation-specific headers; envelope headers still apply. Protocol-level transport properties belong in `Bindings`, not `Headers`, unless the application must read or set them per message — then document them where the client library exposes them and say so.
- `Bindings` uses `Protocol | Property | Value / Rule` and contains only binding facts scoped to that message, such as a partition-key schema or message binding content rule. Write `none` when there is no message-specific binding beyond applicable conventions. Do not move message-scoped facts into Channel or Operation Bindings merely to shorten the document.
- In the compact profile, a valid `**field_defaults**:` marker may immediately precede a header or payload field table under §3.4. The logical reconstructed table still follows the direction-correct full-profile columns above.
- For a non-empty payload, put one `**payload_required**: yes|no|unknown` line(SEND) or `**payload_presence**: always|<condition>|unknown` line(RECEIVE) directly under `#### Payload`, before its representations. It states whether the whole payload may be absent; it is independent of field-level `Required`/`Presence`. Do not write this marker when the payload is `none`. Write `none` directly under `#### Payload` for an authoritatively payload-less message.
- For each expanded non-empty payload representation, put a `**media_type**: <media type>` line, then `**payload_nullable**: yes|no|unknown` except for raw binary, then the **concrete example** and its field table, in that order. `payload_nullable` states whether the entire decoded value may be `null`. The media marker is required even when only one representation exists. In compact only, a valid `**same_as**:` line from §3.4 replaces the expanded representation after the whole-payload marker. Within one `#### Payload`, a concrete media type must appear at most once, including same-as targets by their named media type; when one media type has multiple possible shapes, represent them with `**variant**:` blocks or use the smallest applicable `**unsupported**:` form. When multiple media types are possible, state how the sender selects one and how the receiver branches on the wire format.
- Use realistic example values(`"ord_01HXYZ"` instead of `"string"` or `"foo"`). Prefer an example supplied by an authoritative source when it satisfies the documented representation. A generator-created example must satisfy every machine-verifiable source constraint and must not invent undocumented enum values, identifiers, or business-rule assumptions; if the authoritative inputs cannot support a credible valid example, emit a structurally valid illustrative example with `**unknown**: valid example values require <expected input>` after the representation's required content, and apply `knowledge: requires-input`.
- Every field in the example must have a corresponding row in the field table, including object and array container rows, except the root-object `$` row exception: a root object normally uses its property rows without a `$` row, unless the root object has constraints that cannot be expressed by those rows(such as object openness when no API-wide default applies). Field tables must document every representable field in the source schema, even when a rarely used optional field is absent from the example.
- For every object container, state whether additional properties are forbidden or allowed and, when allowed, their value type — on the container row, or through an API-wide default in `CONVENTIONS.md` `Data Representation` with per-container `**deviation**:` exceptions. A `map<string, T>` is inherently open with values of `T`. Use `$` rows and root paths(`$[].id`, `$.{key}.amount`) for root scalar, array, and map payloads under §3.5.
- **Schema-registry and binary structured encodings**(Avro, Protobuf, and similar): use the encoding's media type in `**media_type**:`, give the example as the value's canonical JSON rendering, and state in prose immediately after the field table that the wire format is binary, which schema(subject, version, or ID) applies, and how the schema is resolved at runtime. The field table documents the logical decoded fields. Schema-registry mechanics shared by all channels belong in `CONVENTIONS.md` `Serialization`.
- **Raw binary payloads**: after `**media_type**:`, give a short prose description of the content, size limits, and any integrity metadata instead of `**payload_nullable**:`, an example, and a field table.
- **Tagged polymorphic payloads**: after the representation's media-type and nullability markers, give each variant its own complete example and field table introduced by `**variant**: <field> = <value>`. Each table repeats all common fields used by that variant; there is no separate common-field table. In every variant table, list every allowed discriminator value in the discriminator row's enum constraint. Order tagged blocks by discriminator value in lexical order. **Untagged alternatives** use `**variant**: <label>` with a stable prose label, optional introductory prose stating how the receiver distinguishes the alternative, then the complete example and field table; order blocks by label. If the valid set cannot be projected faithfully, use the smallest applicable `**unsupported**:` form rather than inventing a discriminator.

**Reply(required)**
- The Reply section documents the correlated counterpart message contract of a request-reply interaction: for a `SEND` operation, the reply the implemented application will receive; for a `RECEIVE` operation, the reply it must send. Write `none` when the operation has no reply contract.
- A non-`none` Reply begins with three canonical keys in this order: `channel`, `correlation`, `timeout`. `channel` is the reply channel address, or `dynamic` followed by the ASCII separator ` -- ` and the exact rule for obtaining it(for example, `dynamic -- taken from the request's `reply_to` header`). `correlation` states exactly which request value the reply carries where, so the application can match a reply to its request. `timeout` states the deadline and the required behavior on expiry(retry with the same deduplication key, escalate, or report unresolved); write `none` for a `RECEIVE` operation whose reply deadline is governed by conventions. Use `unknown` with the required `**unknown**:` marker under §3.4 for any key the authoritative inputs do not establish.
- After the keys, add a required `#### Channel` subsection containing `##### Parameters` then `##### Bindings`. For a static channel address, Parameters follows the primary Channel parameter rule against the reply `channel` value. For `dynamic`, Parameters is `none` and the `channel` key's rule is the authoritative address derivation. Reply Channel Bindings contains only reply-channel-scoped facts. Put a `**deviation**:` directly under `#### Channel` when the reply uses a broker, server, or environment different from `CONVENTIONS.md`.
- After the reply Channel, document each reply message as a `#### Message <name>` section containing `##### Headers`, `##### Bindings`, then `##### Payload`, following all Message section rules at these deeper heading levels. Reply messages use the direction opposite to the operation's action: replies to a `SEND` use `Presence` semantics, and replies a `RECEIVE` operation must send use `Required` semantics.
- A reply documented here is the complete contract: the reply does not additionally appear as its own operation or INDEX row. If the same reply channel also carries messages that are not replies to this operation, those messages are separate operations.

**Failure Handling(required)**
- Write rows for failures whose condition, detection, or required handling is specific to this operation. API-wide failure behavior(dead-lettering, retry policy, poison messages) belongs only in `CONVENTIONS.md` `Error Handling`; operation rows may reference a common failure-signal shape with `common:<label>`.
- Use the columns `Failure | Signal | Condition | Action`. Write `none` instead of a table when there are no operation-specific failure rows; common failure conventions still apply unless a deviation says otherwise. If the only operation-specific fact is that a common failure does not apply, put a `**deviation**:` line directly under `### Failure Handling` naming the suppressed convention, then write `none`.
- `Failure` is a short stable label for the failure. `Signal` states how the implemented application observes the failure: a broker error, a negative acknowledgement, a timeout, a dead-letter delivery, or a failure-signal message referenced as `common:<label>`(defined in `CONVENTIONS.md`) or `inline:<label>`(defined in this section). `Condition` states when the failure occurs. `Action` must explicitly say what the application does next, including whether and when it may resend or re-process, must not retry, or must escalate — and any failure-time state relevant to recovery(for example, whether consumers may have partially processed the command).
- Define each `inline:<label>` shape once, after the table, in first-use row order, as a `**message_shape**: <label>` block using the shape rules of §3.3. Reused labels must have an identical contract. Failure-signal shapes use `Presence` semantics because the application observes them.
- For a `RECEIVE` operation, the rows must cover what the handler does with a message it cannot process: malformed payloads, unknown variants, and handler errors — acknowledge, negatively acknowledge, or route to a dead-letter channel — unless the applicable `CONVENTIONS.md` `Error Handling` conventions fully determine that behavior.

**Related(required)**
- Mention operations, HTTP endpoints, or external interfaces commonly used before or after this operation, and the workflow files that include it. When the messaging API pairs with an HTTP API documented as DocAI HTTP, name the relevant endpoint and set. Write `none` when authoritative inputs establish that no related interface exists; use the whole-section `unknown` form from §3.4 when related-call knowledge is not established.

**Deviations from CONVENTIONS.md**
- Write a deviation inside the section it affects, prefixed with the fixed marker `**deviation**:`(for example, `**deviation**: this channel delivers at-most-once; the API-wide at-least-once convention does not apply`). The fixed marker lets an LLM find every deviation in a file.

## 5. Workflow Definitions (workflows/, optional)

Interactions that require multiple operations in a specific order — sagas, request-reply chains, event choreographies — should be written as workflows.

```markdown
> docai-messaging: 0.2.0 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | generated: 2026-07-27 | generation_id: full-20260727-abc123 | projection_id: 20260727-abc123 | source: asyncapi.yaml (AsyncAPI 3.0.0) | source_revision: sha256:abc123

# Order cancellation

Cancel an order and confirm the outcome.

## Preconditions

- The order exists and is not yet shipped

## Steps

1. SEND orders.commands (cancel-order) -- Set a fresh `message_id` and keep it. The correlated reply arrives on orders.replies within 30s
2. On reply `status` = `cancelled` -- the cancellation is complete; update local state
3. On reply `status` = `rejected` -- surface `rejection_reason`; do not resend
4. On timeout -- resend with the same `message_id`(consumers deduplicate); after 3 attempts, escalate

## State Transitions

| From | Trigger | To |
|---|---|---|
| order.active | SEND orders.commands (cancel-order) | cancel.requested |
| cancel.requested | reply `status` = `cancelled` | order.cancelled |
| cancel.requested | reply `status` = `rejected` | order.active |

## Failure and Recovery

- A resend with the same `message_id` is always safe; consumers deduplicate. A resend with a new `message_id` may be processed as a second command(double refund); never regenerate the key during recovery
```

- Use the fixed headings `Preconditions`, `Steps`, `State Transitions`, and `Failure and Recovery` in that order. Write `none` when a section does not apply.
- The workflow title heading `# <workflow name>` is required. The title should match the `Name` cell in INDEX.md unless the INDEX name is a shorter retrieval label.
- If a workflow section's applicability or content is not established, use the whole-section `unknown` form from §3.4 under that heading and apply `knowledge: requires-input`.
- Use a numbered list to express order. Refer to operations by their exact heading text(`SEND orders.commands (cancel-order)`). For each step, write the values carried to later steps and the failure branches, including timeout branches — in messaging, the absence of a message is itself an outcome that needs a rule.
- State-transition tables use `From | Trigger | To`. Include every transition relevant to completing or recovering the workflow.
- If a workflow has a convention deviation that applies to the whole procedure, put a `**deviation**:` line directly after the intro description; one that applies to a single section goes directly under that section heading.
- Workflow files must be discoverable from the `Workflows` section in INDEX.md, and related operations must reference the workflow from their `Related` section.

## 6. Cross-Cutting Requirements and Writing Style

The per-section rules in §4.1 are normative. This section adds cross-cutting requirements where it uses normative words or imperative instructions under §3.1, and style guidance where it uses advisory words.

- A producer should define a target model, tokenizer, token budget, expected code context, and normal retrieval unit for its deployment and should keep each retrieval within that measured budget. Do not use line count as a split criterion. At minimum, measure the tokens loaded to implement one representative operation against a dereferenced AsyncAPI representation of the same client-visible contract. Regardless of size, producers must preserve the complete applicable client contract and must use the required `unknown` or `unsupported` handling instead of omitting information.
- Prioritize retrieval reductions before syntax-level reductions: select a task-oriented channel shard, then a dependency-closed convention subset, then use compact one-line examples, `field_defaults`, and `same_as` where measured savings remain. A syntax reduction is not beneficial when its marker or added retrieval work costs at least as many tokens as the expanded content.
- Prefer tables, lists, and code blocks over prose. Avoid verbose expressions. Write directly and decisively.
- Escape a literal `|` inside a table cell as `\|`(for example, `` `cancelled` \| `rejected` ``).
- Use clearly fake placeholder values for credentials, tokens, connection strings, and other secrets in every example. A generated document set must never contain a real secret.
- Explicitly state negative facts, such as "there is no ordering across keys" or "no reply is sent for this command". LLMs fill in missing information by guessing, so clearly stating what is not guaranteed prevents hallucination. Delivery guarantees and ordering are where unstated assumptions do the most damage.
- **Reuse the same example values across operations and workflows**: the `ord_01HXYZ` sent in a command example should reappear in the matching reply, event, and workflow examples. Consistent fixtures let an LLM trace a value through a whole message flow.
- Put metadata information at the beginning of **every file**, not only INDEX.md(§3) — files are loaded individually.
- Do not omit information that affects client implementation. Examples: acknowledgement timing relative to processing, redelivery visibility timeouts, deduplication keys, consumer-group semantics, schema-resolution behavior, and what a publish timeout means.
- Distinguish values that may be shown to users from values intended for logs or developers.
- Write each generated DocAI Messaging document set in a **single prose language**. Generated output must not repeat the same content in multiple languages. Structural text is always English(§4.1); the document language applies to prose only.
- Put API-wide mechanics in `CONVENTIONS.md` when the authoritative inputs establish them, and keep operation files to operation-specific requirements and deviations. In particular, envelope headers, delivery defaults, deduplication conventions, and dead-letter policy should each be stated exactly once.

### 6.1 Recommended Retrieval Recipe (non-normative)

For a task that targets one operation:

1. Load `INDEX.md`.
2. If its `profile` is unsupported, follow a discoverable `Full set:` link and verify the same `projection_id`; otherwise report the unsupported profile and stop.
3. Select the operation row by `Task`, `Action`, `Channel`, `Operation`, `Message`, and `Summary`.
4. Load the selected `CONVENTIONS.md` sections named by a trusted optional `Conventions` column. When the column is absent, `all`, or untrusted, load all of CONVENTIONS.md; for a trusted `none`, load only its metadata stamp.
5. Load the channel file named by the selected `###` subsection. When it contains `**same_as**:`, load the producer's discoverable intended retrieval unit, normally the whole channel file, so every referenced earlier representation is present.
6. Load every `Also read` file that is relevant to the task, especially workflows that define message order, timeout handling, or recovery.
7. Stop and report the affected operation as blocked when the selected content contains `**unknown**:` for a fact needed by the implementation, or consult the authoritative source when it contains `**unsupported**:` for a feature needed by the implementation.

Markers that appear only in unrelated channel or workflow files, or in INDEX `Unprojected Operations` for another source operation, affect whole-set implementation readiness but do not block a selected-operation-ready task.

## 7. Relationship with AsyncAPI

- **Conversion is one-directional: authoritative inputs → DocAI Messaging.** DocAI Messaging is a generated artifact. The authoritative input set(AsyncAPI document, code annotations, pass-through convention or workflow content, etc.) is the **maintenance source of truth**; DocAI Messaging is the client-implementation projection the LLM reads. Edit the authoritative inputs and regenerate — never the other way around.
- DocAI Messaging is not a lossless AsyncAPI representation and is not tied to one AsyncAPI version. A generator must identify its exact input in `source` and mark client-relevant input features it cannot project with `**unsupported**:`. Absence of a required fact from AsyncAPI is not evidence that the fact does not apply; the generator must preserve that distinction through `**unknown**:` and `knowledge: requires-input` rather than emitting `none` or guessing(§3.4).
- **Perspective resolution is the generator's job.** An AsyncAPI document describes one application's viewpoint. When the implemented application named by `perspective` is that application, actions carry over directly(AsyncAPI `send` → `SEND`, `receive` → `RECEIVE`). When the implemented application is a counterpart(a consumer of the documented application's events, or a producer of its commands), the generator inverts the actions. Which application the reader implements is projection configuration and part of the `projection_id` snapshot; the reader never re-interprets direction.
- AsyncAPI concepts map as follows. The mapping is indicative, not a conversion contract:

| AsyncAPI | DocAI Messaging |
|---|---|
| `servers` | `CONVENTIONS.md` `Environments`, `Protocols and Bindings`, `Authentication` |
| `channels` and channel `address` | Operation heading address; channel files group operations |
| channel `parameters` | `Channel` `Parameters` table |
| `operations`(`send` / `receive`) | `## SEND ...` / `## RECEIVE ...` definitions, perspective-resolved |
| server / channel / operation / message `bindings` | `CONVENTIONS.md` `Protocols and Bindings` / `Channel` `Bindings` / `Operation Bindings` / each `Message <name>` `Bindings`, preserving source scope |
| `messages`, `payload`, message `headers` | `Message <name>` sections with direction-correct nullable header tables, bindings, and expanded examples and field tables(full), or allowed compact reductions |
| `correlationId`, operation `reply` | `Reply` section(`channel` / `correlation` / `timeout`, reply Channel Parameters and Bindings, and reply messages) |
| `components`, `$ref`, traits | Expanded inline at every use site; no reference notation in output |
| `tags`, `summary`, `description` | INDEX `Task` / `Summary` and purpose prose, rewritten for retrieval |

- DocAI Messaging does not replace AsyncAPI. They coexist: AsyncAPI and other authoritative inputs continue to serve validation, generation, and complete schema semantics; DocAI Messaging serves efficient LLM context.

## 8. Compliance Checklist

A document set is DocAI Messaging-compliant if:

- [ ] INDEX.md and CONVENTIONS.md exist, and every projection snapshot has a full profile set; a compact set exists only as an optional same-snapshot companion
- [ ] The `docai-messaging` value uses `major.minor.patch`; no unknown non-`x-` structural text is present, and every `x-` extension follows the placement rules of §3.1
- [ ] Every file begins with a metadata stamp in the fixed key order of §3, containing `docai-messaging` / `profile` / `perspective` / `coverage` / `knowledge` / `generated` / `generation_id` / `projection_id` / `source`, and `source_revision` when available; stamp values follow the escape rules and contain no unknown escape sequence
- [ ] All files in one profile set share the same `profile`, `perspective`, `generated`, `generation_id`, and `projection_id`; each file's `coverage` matches `**unsupported**:` in its scope and its `knowledge` matches `**unknown**:`, with INDEX.md summarizing both dimensions
- [ ] Matching full and compact roots contain the same standard paths, use the same perspective and `projection_id`, have equal per-file coverage and knowledge, use profile-specific `generation_id` values, and expose valid INDEX profile links; an unknown profile is never interpreted as full
- [ ] INDEX.md begins with `# Messaging Index`, includes `Operations` then `Workflows` in order, groups projected operations into one `###` subsection per channel file, and fills `Action`, `Channel`, `Operation`, `Message`, `Task`, `Summary`, and `Also read`, or writes `none` for an empty section
- [ ] An optional final INDEX `Conventions` column uses exact dependency-closed convention headings, `all`, or `none`; ignoring it and loading all conventions remains correct, and it is emitted only when measured retrieval savings exceed its cost
- [ ] Every source operation missing a representable action or address is absent from normal rows and appears once under optional `Unprojected Operations` with the canonical localized `unsupported` or `unknown` marker, making INDEX coverage or knowledge incomplete as applicable
- [ ] CONVENTIONS.md uses every fixed heading in §3.3 in order; every common failure-signal shape is a complete `**message_shape**:` block with Headers, Bindings, and receive-side Payload content; convention-level `none` appears only for established non-applicability, and unestablished conventions use the whole-section unknown form
- [ ] The set is written in a single prose language, and all structural text is English(§4.1)
- [ ] Operation headings, channel addresses, message names, media types, file paths, profile-link paths, table escape parity and cell normalization, field paths, and the type grammar follow §3.5
- [ ] Source identifiers are reused only when valid and unique in their required scope; every derived operation or message name uses the complete SHA-256 and canonical length-prefixed source identity from §3.5 and is stable across generator runs that use the same canonical source identity
- [ ] Every operation follows the fixed section structure and order(`Behavior`, `Operation Bindings`, `Channel`, `Message`, `Reply`, `Failure Handling`, `Related`); each operation appears in exactly one bounded channel file, and channel files contain no file-level title or prose wrapper
- [ ] The `Behavior` section uses `side_effects` / `idempotency` / `preconditions` / `authorization` / `delivery` / `ordering` in order; operation-local `none` means no local addition and preserves conventions; missing facts use `unknown`; every concrete delivery begins with a canonical guarantee token, and `exactly-once` states its scope and conditions
- [ ] Server, operation, channel, primary-message, reply-channel, reply-message, and failure-message binding facts remain in their defined scopes; each local Bindings section uses `Protocol | Property | Value / Rule`, `none`, or the applicable incomplete-information form
- [ ] Every primary Message contains `Headers`, `Bindings`, then `Payload`; every reply Message uses the same roles one level deeper; multi-message operations state each selection rule and order message sections lexically
- [ ] Send-side header and field tables use `Required=yes|no|conditional|unknown`, every conditional row states its exact condition, receive-side tables use `Presence=always|<exact condition>|unknown`, and every represented header and payload field has `Nullable=yes|no|unknown`
- [ ] Every non-empty payload states `**payload_required**:`(send-side) or `**payload_presence**:`(receive-side) when representable; every expanded form starts with `**media_type**:`, followed by `**payload_nullable**:` except for raw binary, a concrete example, and its field table; each concrete media type appears at most once, with alternatives represented as variants or unsupported
- [ ] Every example field, including containers, has a corresponding field-table row except the root-object `$` exception; generated examples satisfy every machine-verifiable source constraint or carry the required unknown indication; example values are realistic and reused consistently
- [ ] Every object container's openness is stated on its row or through the API-wide default with explicit deviations; `null` and `any` follow §3.5; enum values live in constraints or meaning cells
- [ ] Polymorphic payloads have no unlabeled example or common table; every `**variant**:` block has a complete example and field table and follows the ordering rules of §4.1
- [ ] Every non-`none` Reply begins with `channel` / `correlation` / `timeout`, contains Channel Parameters then Bindings, and then complete reply Message sections in the direction opposite to the operation action; embedded replies do not appear as separate operations
- [ ] Every Failure Handling section is `none`, a valid suppression-only deviation, or a `Failure | Signal | Condition | Action` table whose shape references resolve exactly once; every Action states resend/re-process/escalation behavior and recovery-relevant state
- [ ] Client-relevant source features that cannot be projected faithfully use the smallest localized or replacement `**unsupported**:` form, name the feature and source location, and set `coverage: requires-source`; recursive shapes are never finitely truncated
- [ ] Missing authoritative facts use `unknown` only in allowed positions with a marker naming the fact and expected input and set `knowledge: requires-input`; no compact default covers an unknown cell, and `none` never substitutes for missing knowledge
- [ ] A compact `**field_defaults**:` marker defaults only allowed uniform logical columns, reconstructs the full table before validation, and produces measured token savings; full never uses it
- [ ] A compact `**same_as**:` is a direct same-file backward reference to an earlier expanded, complete, semantically identical payload representation with the same table direction and media type; its retrieval unit is discoverable, it produces measured savings, and full and failure shapes never use it
- [ ] Compact one-line examples preserve the exact value and remain readable; every compact reduction preserves the same client-visible contract, coverage, and knowledge as full
- [ ] Deviations from CONVENTIONS.md are marked with `**deviation**:` in the affected section; deprecated operations have a `**deprecated**:` line after the heading and `(deprecated)` in their INDEX.md summary
- [ ] Workflow files include a required `# <workflow name>` title, use every fixed heading in §5, are referenced from INDEX.md and related operations, refer to operations by exact heading text, and document carried values, failure branches including timeouts, and relevant state transitions

Before a release advertises a compatibility-preserving implementation target for the complete 0.2 surface, it must publish versioned valid and invalid fixtures covering at least: paired full and compact roots and fallback; unknown profiles; unprojected unsupported and unknown operations; every binding scope including reply and failure messages; nullable and conditionally required headers and fields; stable derived names; table escape parity; dependency-closed selective conventions; valid and invalid field defaults; valid and invalid same-as targets and retrieval-unit discovery; and measured compact output that preserves coverage, knowledge, and the complete client-visible contract.
