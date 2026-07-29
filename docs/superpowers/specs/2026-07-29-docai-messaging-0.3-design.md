# DocAI Messaging 0.3 Design

## Goal

Revise the DocAI Messaging draft so that schema projection, source conflict
resolution, identifier stability, retrieval routing, and token-saving claims are
deterministic enough to support a future compatibility-preserving implementation
target.

The normative specification remains in `docai-messaging/README.md`. This design
document records the approved change before that specification is edited.

## Version and compatibility scope

- Change the draft format version from `0.2.0` to `0.3.0` because the changes
  alter existing identifier and INDEX semantics.
- Define a Compatibility Core containing the full profile, INDEX routing,
  whole-file CONVENTIONS loading, basic Message/Reply/Failure Handling
  structures, and the canonical `unknown` and `unsupported` forms.
- Keep compact output, `field_defaults`, `same_as`, selective convention
  loading, workflows, polymorphism, and non-JSON representations in the
  specification but outside the default Core until versioned fixtures promote
  them.
- Require a publication label to state whether it covers only the Core or the
  complete generator surface.

## Authoritative input resolution

- Projection configuration defines a deterministic precedence order for every
  authoritative input class, including AsyncAPI, annotations, and pass-through
  content.
- The precedence configuration is part of `projection_id`.
- A lower-priority source may enrich an absent fact but cannot silently replace a
  conflicting higher-priority fact.
- If equally authoritative or otherwise unresolved inputs disagree about a
  client-visible fact, generation fails. The generator must not turn this state
  into `unknown` or `unsupported` and must not publish a compliant set.

## Schema representability

Add a normative, default-deny representability section.

- Directly represent simple scalar types, objects, homogeneous arrays,
  string-keyed maps, requiredness or presence, nullability, object openness,
  enums, constants, and exact scalar or collection constraints that can be
  preserved in canonical constraint prose.
- Resolve references and traits before projection.
- Flatten `allOf` only when the exact intersection can be computed without
  conflict or information loss.
- Project `oneOf` and `anyOf` as variants only when all branches are
  representable and the sender or receiver selection rule is complete.
- Treat recursive schemas, conditional schemas, `not`, `patternProperties`,
  tuple arrays, `contains`, dependent schemas, unknown keywords, and unknown
  schema dialects as unsupported at the smallest safe unit.
- Treat an unrecognized source extension as ignorable only when the adapter can
  prove that it is annotation-only and has no client-visible effect.
- Keep wire `contentType` distinct from schema `schemaFormat`. Avro, Protobuf,
  and other schema formats require a registered projection rule; otherwise the
  affected representation is unsupported.

## Missing structural identity

- Prefer an explicit stable-name override from projection configuration, then a
  valid set-unique source identifier, then a derived name.
- If a primary message has neither a usable identifier nor stable source
  identity and location, omit its complete operation from normal routing and
  report the operation under `Unprojected Operations` with `knowledge:
  requires-input`.
- If only a reply message lacks stable identity, retain the primary operation
  and use the existing whole-section `unknown` form for `Reply`.
- Do not refer to a nameless whole-message form that cannot be encoded by the
  grammar.

## Derived identifiers

- Hash the existing canonical length-prefixed source identity with SHA-256.
- Normally encode the first 128 bits as lowercase unpadded RFC 4648 base32:
  `op-` or `msg-` followed by 26 characters.
- Detect collisions in the required uniqueness scope. If a collision occurs,
  encode the full 256-bit digest for every colliding identifier as 52 lowercase
  unpadded base32 characters.
- A stable-name override may replace even a valid source identifier when
  refactoring stability is required. It must satisfy the standard name grammar
  and required uniqueness scope. Duplicate overrides fail generation.
- Stable-name overrides are projection inputs. Collision expansion is a
  deterministic result of the complete projected name set.

## INDEX routing

- Keep the `Message` column rather than adding another repeated column.
- List primary message names first.
- Append reply message names using the canonical `reply:<name>` form.
- Use lexical ordering within the primary and reply groups.
- Update selection guidance so a task naming a reply can locate its containing
  operation without loading unrelated channel files.

## Token evidence

Add a normative token-evidence section without adding measurement data to the
runtime document set.

- The measured-savings conditions for `field_defaults`, `same_as`, and selective
  convention loading remain producer assertions for an ordinary generated set.
- A release or producer that advertises measured optimization must publish a
  versioned out-of-band evidence artifact.
- Evidence records the tokenizer and version, target model when relevant,
  baseline representation, retrieval-unit policy, task corpus, loaded files,
  per-task totals, and p50, p95, and maximum loaded tokens.
- Compare total task context, including INDEX, applicable conventions, channel
  content, workflows, and full-profile fallback. File size alone is not
  sufficient.
- Compatibility Core readers load all of CONVENTIONS. Selective convention
  loading remains outside the Core until fixtures and measurements demonstrate
  a safe dependency-closed process.

## AsyncAPI mapping

Expand the mapping guidance to cover:

- server and operation `security`;
- channel `servers`;
- `defaultContentType` and message `contentType`;
- payload and header `schemaFormat`;
- `info.version`, distinguished from the AsyncAPI specification version; and
- `externalDocs`.

The generated `source` stamp identifies the logical API and contract version
when available, as well as the source format and exact specification version.

## Example safety

- Never copy a source example containing a real secret, personal information,
  regulated data, or other confidential production value.
- Generate synthetic values that remain valid against every machine-checkable
  constraint.
- If safe valid values cannot be generated, retain the required incomplete
  knowledge signaling rather than weakening constraints.

## Validation and publication

- Update every example, structural-text inventory, compatibility statement,
  retrieval recipe, checklist item, and fixture requirement affected by the
  changes.
- Require future valid and invalid fixtures for representability boundaries,
  source conflicts, missing primary and reply identity, short and collision
  identifier forms, reply INDEX routing, and token-evidence claims.
- The README remains a design-review draft; this edit does not itself declare
  the Core or complete surface implementation-ready.
