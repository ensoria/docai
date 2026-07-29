# DocAI Messaging 0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the DocAI Messaging README to define a deterministic 0.3 draft for schema projection, source conflicts, stable identifiers, reply routing, and evidenced token reductions.

**Architecture:** Keep `docai-messaging/README.md` as the only normative specification and integrate each rule into the section that owns its syntax or reader behavior. Add one projection-boundary section under §3 and one token-evidence section under §6, then align examples, retrieval guidance, AsyncAPI mappings, the compliance checklist, and fixture requirements.

**Tech Stack:** Normative Markdown, Git, shell-based consistency checks.

## Global Constraints

- Modify the normative contract only in `docai-messaging/README.md`.
- Preserve English for all specification prose and structural examples.
- Use DocAI Messaging `0.3.0`; incompatible pre-1.0 changes increment the minor version.
- Keep the full profile required and compact optional.
- Do not claim that this documentation-only change publishes an implementation-ready compatibility surface.
- Preserve the distinction between absent authoritative knowledge (`unknown`) and supplied but unrepresentable information (`unsupported`).
- Do not add runtime document tokens solely to carry benchmark evidence; token evidence remains out of band.

---

### Task 1: Establish the 0.3 compatibility boundary

**Files:**
- Modify: `docai-messaging/README.md:1-121`

**Interfaces:**
- Consumes: The approved version and Compatibility Core design in `docs/superpowers/specs/2026-07-29-docai-messaging-0.3-design.md`.
- Produces: The `0.3.0` version identity and publication-scope rules used by every later task.

- [ ] **Step 1: Record the pre-change version references**

Run:

```bash
rg -n '0\.2\.0|second design draft|Publication label' docai-messaging/README.md
```

Expected: the header and examples still declare `0.2.0`, and the introduction says “second design draft”.

- [ ] **Step 2: Update the draft identity**

Change every normative and example format version from `0.2.0` to `0.3.0`,
change “second design draft” to “third design draft”, and retain
`Publication label: Design-review draft`.

- [ ] **Step 3: Define publication scopes under §3.1**

After the extension-placement rules, add a fixed pre-1.0 publication-scope
subsection with these semantics:

```markdown
#### 3.1.1 Pre-1.0 Publication Scopes

The default Compatibility Core contains the full profile; metadata and set
identity; INDEX routing without selective convention loading; whole-file
CONVENTIONS loading; ordinary operation, Message, Reply, and Failure Handling
structures; canonical syntax; and unknown/unsupported signaling.
```

State that compact output, `field_defaults`, `same_as`, selective Conventions,
workflows, polymorphism, non-JSON representations, and token-routing hints remain
valid advanced structures but are outside the Core until a versioned fixture
corpus promotes them. Require every implementation-target publication to say
whether it covers the Core or the complete generator surface.

- [ ] **Step 4: Verify the version and scope wording**

Run:

```bash
rg -n '0\.2\.0|second design draft' docai-messaging/README.md
rg -n '0\.3\.0|Pre-1.0 Publication Scopes|Compatibility Core|complete generator surface' docai-messaging/README.md
```

Expected: the first command returns no matches; the second finds the header,
metadata examples, and new scope subsection.

- [ ] **Step 5: Commit the compatibility boundary**

```bash
git add docai-messaging/README.md
git commit -m "docs: define DocAI Messaging 0.3 compatibility scope"
```

---

### Task 2: Make routing and structural identity deterministic

**Files:**
- Modify: `docai-messaging/README.md:123-161`
- Modify: `docai-messaging/README.md:296-317`
- Modify: `docai-messaging/README.md:506-511`
- Modify: `docai-messaging/README.md:586-598`

**Interfaces:**
- Consumes: The 0.3 publication scope from Task 1 and the existing INDEX,
  incomplete-information, canonical-name, Reply, and retrieval grammars.
- Produces: Reply-addressable INDEX rows, encodable missing-name fallbacks, and
  shorter stable derived identifiers.

- [ ] **Step 1: Extend the INDEX example and `Message` cell grammar**

Change the request-reply example cell to:

```markdown
cancel-order; reply:cancel-order-reply
```

Specify that primary names appear first in lexical order, followed by reply
names in lexical order using `reply:<message-name>`, all separated by `; `.
State that `reply:` is an INDEX routing prefix and is not part of the Message
name. Update the retrieval recipe so a task naming a reply selects its
containing operation directly.

- [ ] **Step 2: Define missing primary and reply identity behavior**

Replace references to an undefined nameless whole-message form with these exact
outcomes:

- a primary message without a valid source name, stable-name override, or stable
  source identity/location makes the complete source operation unprojected;
- INDEX reports that operation under `Unprojected Operations` with a canonical
  `**unknown**:` marker and `knowledge: requires-input`;
- a reply-only identity failure retains the operation but renders the complete
  `Reply` section as `unknown` followed by its marker.

Expand the `Unprojected Operations` marker grammar so missing primary-message
identity is an allowed reason.

- [ ] **Step 3: Replace the derived-name algorithm**

Keep the canonical length-prefixed SHA-256 input, but specify:

```text
normal:    op-|msg- + 26 lowercase unpadded RFC 4648 base32 characters
collision: op-|msg- + 52 lowercase unpadded RFC 4648 base32 characters
alphabet:  a-z and 2-7
```

The normal form encodes the first 128 digest bits. When two normal forms collide
within the required uniqueness scope, every colliding name uses the complete
256-bit form. Collision expansion is derived from the complete projected name
set.

- [ ] **Step 4: Add stable-name overrides**

Define projection-configuration overrides as the first name source, before a
valid native source identifier and before hash derivation. Require the override
to match `[A-Za-z0-9._-]+`, satisfy the operation or message uniqueness scope,
and fail generation on duplicates. State that the override configuration is
part of `projection_id`.

- [ ] **Step 5: Update structural vocabulary and the checklist**

Add `reply:` to the structural-text inventory. Replace checklist references to
64 hexadecimal digits with the normal and collision base32 forms, override
precedence, and the two missing-message outcomes.

- [ ] **Step 6: Verify routing and identifier terminology**

Run:

```bash
rg -n 'reply:cancel-order-reply|reply:<message-name>|stable-name override|26 lowercase|52 lowercase|RFC 4648|primary message.*unprojected|Reply.*unknown' docai-messaging/README.md
rg -n 'all 64 lowercase hexadecimal|whole-message unknown form' docai-messaging/README.md
```

Expected: the first command finds every new rule; the second returns no matches.

- [ ] **Step 7: Commit routing and identifier changes**

```bash
git add docai-messaging/README.md
git commit -m "docs: stabilize messaging routes and derived names"
```

---

### Task 3: Define source resolution and schema representability

**Files:**
- Modify: `docai-messaging/README.md:302-320`
- Modify: `docai-messaging/README.md:489-504`
- Modify: `docai-messaging/README.md:600-619`

**Interfaces:**
- Consumes: Existing `unknown`, `unsupported`, schema-field, media-type, and
  AsyncAPI projection rules.
- Produces: New normative §3.6, deterministic conflict handling, default-deny
  schema projection, safe examples, and expanded AsyncAPI mapping.

- [ ] **Step 1: Add §3.6 after Canonical Syntax and Boundaries**

Create:

```markdown
### 3.6 Authoritative Input Resolution and Schema Representability
```

Define deterministic input-class precedence in projection configuration. A
lower-priority source may fill an absent fact but cannot replace a conflicting
higher-priority fact. Unresolved conflicts in client-visible facts abort the
generation run; they are neither `unknown` nor `unsupported`, and no compliant
set is emitted. Include precedence configuration in `projection_id`.

- [ ] **Step 2: Add a default-deny representability table**

Use a `Source feature | Projection rule` table covering these exact classes:

- scalar types, exact-null, objects, properties, homogeneous arrays, and
  string-keyed maps;
- requiredness/presence, nullability, object openness, enum, const, format,
  numeric bounds, string length/pattern, array length/uniqueness, and object
  property-count constraints;
- `$ref` and traits after complete resolution;
- `allOf` only after lossless intersection and flattening;
- `oneOf`/`anyOf` only when every branch and complete selection rule can be
  represented as variants;
- recursive schemas, conditionals, `not`, `patternProperties`, `propertyNames`,
  tuple arrays, `contains`, dependent schemas, unknown keywords, and unknown
  dialects as the smallest safe `unsupported` unit;
- unknown source extensions as unsupported unless an adapter proves they are
  annotation-only and have no client-visible effect.

State that a generator must not translate an unlisted semantic keyword into
free prose and call the result complete.

- [ ] **Step 3: Separate wire media type from schema format**

Define message `contentType` or AsyncAPI `defaultContentType` as the source of
DocAI `media_type`. Define `schemaFormat` as the schema language used during
projection, not the wire media type. Avro, Protobuf, and other non-default
formats require a published, version-specific adapter rule that preserves
logical constraints and runtime schema resolution; otherwise use
`unsupported`.

Adjust the current Avro/Protobuf prose so “canonical JSON rendering” is allowed
only when the registered format rule defines that rendering.

- [ ] **Step 4: Add API identity and version requirements**

Require `source` to distinguish:

- logical API identity and contract version, such as AsyncAPI `info.version`;
- source document or system;
- source specification name and exact version.

When no logical API version exists in the authoritative source, require the
generator to keep `source` limited to known source facts and place an
`**unknown**:` marker for the missing API contract version in
`CONVENTIONS.md` `Schema Evolution`, applying `knowledge: requires-input`,
rather than inventing a version.

- [ ] **Step 5: Expand the AsyncAPI mapping**

Add mapping rows for server and operation `security`, channel `servers`,
`defaultContentType` and message `contentType`, payload/header `schemaFormat`,
`info.version`, and `externalDocs`. Preserve the distinction between connection
authentication and operation authorization, server availability and channel
selection, schema language and wire encoding, and API version and AsyncAPI
specification version.

- [ ] **Step 6: Strengthen example safety**

Change the example-source rule so authoritative examples containing real
secrets, personal information, regulated data, or confidential production
values must not be copied. Require constraint-valid synthetic replacements. If
a safe valid example cannot be established, use the existing
`**unknown**: valid example values require ...` form and `knowledge:
requires-input`.

- [ ] **Step 7: Verify projection coverage**

Run:

```bash
rg -n 'Authoritative Input Resolution and Schema Representability|unresolved conflict|default-deny|patternProperties|propertyNames|schemaFormat|defaultContentType|info.version|personal information|regulated data' docai-messaging/README.md
```

Expected: matches occur in §3.6, Message rules, AsyncAPI mapping, example safety,
and the checklist.

- [ ] **Step 8: Commit projection rules**

```bash
git add docai-messaging/README.md
git commit -m "docs: define deterministic messaging projection rules"
```

---

### Task 4: Add evidence-based token optimization rules

**Files:**
- Modify: `docai-messaging/README.md:123-160`
- Modify: `docai-messaging/README.md:227-254`
- Modify: `docai-messaging/README.md:569-598`
- Modify: `docai-messaging/README.md:621-656`

**Interfaces:**
- Consumes: Compatibility scopes from Task 1 and routing/projection behavior
  from Tasks 2 and 3.
- Produces: Normative §6.2 evidence requirements, conservative Core retrieval,
  and complete compliance/fixture coverage.

- [ ] **Step 1: Clarify selective Conventions behavior**

Keep the optional `Conventions` column valid for the advanced surface. State
that Core readers ignore it and load all of `CONVENTIONS.md`. A complete-surface
reader may trust it only when the publication's versioned fixtures cover
dependency closure and the producer's evidence shows lower total task tokens.
Do not introduce a convention dependency mini-language in 0.3.

- [ ] **Step 2: Clarify compact optimization assertions**

For `field_defaults` and `same_as`, retain semantic validity requirements and
state that measured savings are producer assertions in an ordinary document
set. Syntax validators validate reconstruction and reference rules but do not
claim token savings without the external measurement inputs.

- [ ] **Step 3: Add §6.2 Token Measurement Evidence**

After the retrieval recipe, add:

```markdown
### 6.2 Token Measurement Evidence
```

Require a versioned out-of-band evidence artifact whenever a release or
producer advertises measured token optimization. Require the artifact to record
the tokenizer name and version, target model when relevant, baseline,
retrieval-unit policy, task corpus, exact files loaded per task, per-task total,
and p50, p95, and maximum loaded tokens.

Define total task context as INDEX plus applicable CONVENTIONS, selected channel
retrieval unit, relevant workflows, and any full-profile fallback. Prohibit
using file size or the compact file alone as proof of savings. Keep the evidence
artifact outside the runtime document set and normal retrieval path.

- [ ] **Step 4: Align retrieval guidance with publication scope**

Update §6.1 so a Core reader loads all conventions and does not rely on compact
or selective reductions. Preserve the complete-surface path for trusted
optional structures. Reply-name task selection must use the new `reply:` INDEX
entry.

- [ ] **Step 5: Expand checklist and fixture requirements**

Add checklist coverage for:

- declared Core versus complete-surface publication scope;
- input-precedence conflicts failing generation;
- default-deny representability;
- missing primary and reply identity outcomes;
- normal and collision derived IDs;
- reply INDEX routing;
- producer-assertion versus evidence-backed token claims;
- safe authoritative examples; and
- the expanded AsyncAPI mapping boundaries.

Require future valid and invalid fixtures for each item and a token-evidence
fixture containing per-task totals plus p50, p95, and maximum values.

- [ ] **Step 6: Verify token-evidence terminology**

Run:

```bash
rg -n 'Token Measurement Evidence|producer assertion|out-of-band|p50|p95|maximum loaded tokens|Core reader|complete-surface reader' docai-messaging/README.md
```

Expected: the new terms occur in compact rules, retrieval guidance, §6.2, the
checklist, and fixture requirements.

- [ ] **Step 7: Commit token-evidence rules**

```bash
git add docai-messaging/README.md
git commit -m "docs: require evidence for messaging token reductions"
```

---

### Task 5: Perform whole-spec consistency verification

**Files:**
- Verify: `docai-messaging/README.md`
- Verify: `docs/superpowers/specs/2026-07-29-docai-messaging-0.3-design.md`

**Interfaces:**
- Consumes: All README changes from Tasks 1-4.
- Produces: Evidence that the updated normative text is internally consistent
  and covers the approved design.

- [ ] **Step 1: Check formatting and stale terminology**

Run:

```bash
git diff --check HEAD~4..HEAD
rg -n '0\.2\.0|second design draft|all 64 lowercase hexadecimal|whole-message unknown form' docai-messaging/README.md
```

Expected: both commands produce no error; the stale-term search returns no
matches.

- [ ] **Step 2: Check Markdown fence balance**

Run:

```bash
awk '/^```/{count++} END { print count; exit count % 2 }' docai-messaging/README.md
```

Expected: an even number and exit status 0.

- [ ] **Step 3: Check required headings and ordering**

Run:

```bash
rg -n '^### 3\\.1|^#### 3\\.1\\.1|^### 3\\.2|^### 3\\.3|^### 3\\.4|^### 3\\.5|^### 3\\.6|^## 4\\.|^### 6\\.1|^### 6\\.2|^## 7\\.|^## 8\\.' docai-messaging/README.md
```

Expected: monotonically increasing line numbers in the specified order.

- [ ] **Step 4: Check approved-design coverage**

Run:

```bash
rg -n 'Compatibility Core|complete generator surface|unresolved conflict|schema representability|reply:<message-name>|26 lowercase|52 lowercase|stable-name override|Token Measurement Evidence|personal information|server.*security|channel.*servers' docai-messaging/README.md
```

Expected: every approved design topic has at least one normative match.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff HEAD~4 -- docai-messaging/README.md
git status --short
```

Expected: only the approved README changes are present and the worktree is
clean after the four implementation commits.
