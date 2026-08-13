# Source Traceability

This file records the source-to-output audit for the DocAI Messaging `0.17.1` Compatibility Core contract-complete full fixture. JSON locations use JSON Pointer syntax relative to the named source file.

## Decision and Boundary

The source fixtures and this audit are versioned corpus evidence. They do not define a public AsyncAPI-to-DocAI converter API. The corpus checker validates the normalized document-set contract and selected source facts; this file records the semantic mappings that cannot be proven by structural validation alone.

The main projection uses only the two sources listed by `source/projection-input-manifest.json`. Inputs under `source/focused/` exercise independent boundary cases and do not contribute to `valid/full/`, its projection identity, or the completeness claims below.

## Source Fixtures

| Source | Role | Main projection evidence |
|---|---|---|
| `source/projection-input-manifest.json` | Exact source bytes, precedence, source-application perspective, adapter versions, generator identity, stable-name overrides, and publication-policy identity. | Opening metadata, source selection, projection identity, direction policy, adapter eligibility, and default name projection. |
| `source/storefront.asyncapi.json` | AsyncAPI `3.1.0` API identity, contract version, servers, channels, operations, message selection, reply selection, security, header and payload schemas, and examples. | INDEX Sources and Operations; environment, protocol, authentication, serialization, schema-evolution conventions; operation and message structures. |
| `source/storefront-behavior.json` | Authoritative pass-through behavior for conventions, operation behavior, reply correlation and timeout, failure recovery, and known non-applicability. | CONVENTIONS and operation Behavior, Reply, and Failure Handling sections. |

## Document Metadata and Identity

| Output fact | Authoritative input or derivation | Projected files |
|---|---|---|
| `docai-messaging: 0.17.1` | Manifest `#/docaiMessaging`. | Every file in `valid/full/`. |
| `profile: full` | Selected output profile; profile is intentionally excluded from the profile-independent projection snapshot. | Every file in `valid/full/`. |
| `perspective: storefront-service` | Manifest `#/perspective`, with `mode=source-application-carry-through`. | Every file in `valid/full/`. |
| `coverage: complete` and `knowledge: complete` | The source and representation audit in this file: both selected operations and all selected messages are representable, required behavior facts are present, and no incomplete marker is needed. | Every file in `valid/full/`. |
| `source_refs: all` | Manifest `#/sources` and `#/precedence`; both main sources contribute to each full-set file. | Every file in `valid/full/`. |
| `projection_digest` and `projection_id` | Exact bytes of `source/projection-input-manifest.json` and the DocAI Messaging short-ID rule. | Root identity and every child identity. |
| `set_digest` and `set_id` | `tools/restamp-document-set.mjs` over the closed `valid/full/` root after substituting the canonical self identity. | Root identity and every child identity. |

## INDEX Fact Matrix

| Output unit | Authoritative input | Semantic mapping |
|---|---|---|
| Sources row `storefront-asyncapi-3.1.0` | Manifest `#/sources/0`; AsyncAPI `#/asyncapi`, `#/id`, and `#/info/version`. | Exact source ID, specification version, logical API identity, contract version, location, and revision. |
| Sources row `storefront-behavior` | Manifest `#/sources/1`; behavior `#/sourceId`, `#/kind`, and `#/revision`. | Non-API source cells use the normalized `none` sentinel. |
| RECEIVE row `receiveOrderCreated` | AsyncAPI `#/operations/receiveOrderCreated`, `#/channels/orderEvents`, and `#/components/messages/OrderCreated`; behavior `#/operationBehavior/receiveOrderCreated`. | Source-application action carries through as RECEIVE. The task label is the stable normalized label for the behavior purpose; Summary is the AsyncAPI operation summary. |
| SEND row `sendCreateOrder` | AsyncAPI `#/operations/sendCreateOrder`, `#/channels/orderCommands`, `#/components/messages/CreateOrder`, and its `reply`; behavior `#/operationBehavior/sendCreateOrder`. | Source-application action carries through as SEND. The primary and reply identities retain source message names; `reply:` is INDEX routing syntax only. |
| `Required context` and `Supplemental context` are `none` | The selected sources define complete single-operation behavior and no additional required or supplemental document; manifest `#/generator` and `#/publicationPolicy` select this corpus projection. | No client-required fact is moved to a workflow or reference document. |
| Workflows `none` | Main-source operation inventory and the closed `valid/full/` output inventory. | No cross-operation workflow document is projected for this scenario, so the required root section uses its empty state. |
| No Unprojected Operations section | AsyncAPI `#/operations`; manifest `#/adapters`, `#/perspective`, and `#/stableNameOverrides`. | Both authoritative source operations have established direction, identity, message selection, and supported representations and therefore appear as normal routing rows. |

## CONVENTIONS Fact Matrix

| CONVENTIONS section | Authoritative input | Projected meaning |
|---|---|---|
| Environments | AsyncAPI `#/servers/production`; behavior `#/environments/production`. | Selected server name, broker address, and corpus selection rule. |
| Protocols and Bindings | AsyncAPI `#/servers/production/protocol` and `#/servers/production/protocolVersion`; behavior `#/protocolsAndBindings`. | Kafka version plus logical-header encoding and exposure. |
| Authentication | AsyncAPI security under both operations; behavior `#/authentication` and `#/authorization`. | OAuth2 client credentials, token location and rotation, and operation-specific scopes. |
| Connection and Session | Behavior `#/connectionAndSession`. | Reconnection range and authenticated-session publish rule. |
| Serialization | AsyncAPI `#/defaultContentType` and message `contentType` values; behavior `#/serialization`. | UTF-8 JSON wire representation and inline schema resolution. |
| Message Envelope | Behavior `#/messageEnvelope`. | Exact message, correlation, and reply-address header names. |
| Delivery Semantics | Behavior `#/delivery` and `#/acknowledgement`. | At-least-once delivery, redelivery identity, acknowledgement, negative acknowledgement, and redelivery timeout. |
| Idempotency and Deduplication | Behavior `#/deduplication`. | Deduplication key, retention, and tenant scope. |
| Ordering | Behavior `#/ordering`. | Per-order publish order and the negative cross-order guarantee. |
| Error Handling | Behavior `#/failureRecovery` and `#/acknowledgement/nack`. | Retryable versus non-retryable action, five-attempt boundary, and dead-letter destination. |
| Request-Reply | AsyncAPI `#/operations/sendCreateOrder/reply`; behavior `#/requestReply`. | Reply channel, correlation rule, five-second timeout, and ambiguous timeout outcome. |
| Schema Evolution | AsyncAPI `#/id` and `#/info/version`; behavior `#/schemaEvolution`. | Logical API, contract version, and additive-versus-breaking evolution rule. |
| Data Representation | Behavior `#/dataRepresentation/date-time`. | Exact `date-time` constraint role and RFC 3339 meaning. |
| Empty and Omitted Values | Behavior `#/emptyAndOmittedValues`. | Global non-nullability and omission rule. |
| Rate Limits and Quotas | Behavior `#/rateLimitsAndQuotas/applies`. | Authoritative `false` maps to the section's `none` state. |

## Operation Fact Matrix

| Output operation unit | Authoritative input | Semantic mapping |
|---|---|---|
| RECEIVE heading, channel, purpose, and Behavior | AsyncAPI `#/operations/receiveOrderCreated` and `#/channels/orderEvents/address`; behavior `#/operationBehavior/receiveOrderCreated`. | Identity and routing are structural; the six Behavior values preserve the pass-through source meanings in canonical key order. |
| SEND heading, channel, purpose, and Behavior | AsyncAPI `#/operations/sendCreateOrder` and `#/channels/orderCommands/address`; behavior `#/operationBehavior/sendCreateOrder`. | Identity and routing are structural; the six Behavior values preserve the pass-through source meanings in canonical key order. |
| RECEIVE Operation Bindings `none` | AsyncAPI `#/operations/receiveOrderCreated`. | No operation binding object is present, so there is no operation-local binding addition. |
| SEND Operation Bindings `none` | AsyncAPI `#/operations/sendCreateOrder`. | No operation binding object is present, so there is no operation-local binding addition. |
| RECEIVE Channel Parameters and Bindings `none` | AsyncAPI `#/channels/orderEvents`. | The static address has no template parameters, and no channel binding object is present. |
| SEND Channel Parameters and Bindings `none` | AsyncAPI `#/channels/orderCommands`. | The static address has no template parameters, and no channel binding object is present. |
| RECEIVE Reply `none` | Behavior `#/operationBehavior/receiveOrderCreated/noReply`. | Authoritative `true` establishes that the receive operation has no reply. |
| SEND expanded Reply keys and channel | AsyncAPI `#/operations/sendCreateOrder/reply` and `#/channels/orderReplies`; behavior `#/requestReply`. | Reply channel and message selection are structural; correlation and timeout meanings are pass-through behavior. |
| RECEIVE Failure Handling | Behavior `#/operationFailures/receiveOrderCreated`. | Both rows preserve the source Failure, Signal, Condition, and Action values. |
| SEND Failure Handling | Behavior `#/operationFailures/sendCreateOrder`. | Both rows preserve the source Failure, Signal, Condition, and Action values. |
| Related `none` | INDEX context inventory and the closed full-set file inventory. | `Related` is navigation-only; no additional relation is known for either operation. |

## Message and Representation Matrix

| Projected message | Direction source | Contract source | Representation mapping |
|---|---|---|---|
| `OrderCreated` | AsyncAPI `#/operations/receiveOrderCreated/action`. | `#/components/messages/OrderCreated/headers`, `#/components/messages/OrderCreated/payload`, and `#/components/messages/OrderCreated/examples/0/payload`. | RECEIVE uses Presence semantics. `contentType=application/json` and manifest payload/schema adapters select direct JSON; required schema members become `always`; absence of a `null` type becomes `Nullable=no`; `additionalProperties=false`, `format`, `pattern`, and `const` retain their normalized meanings. |
| `CreateOrder` | AsyncAPI `#/operations/sendCreateOrder/action`. | `#/components/messages/CreateOrder/headers`, `#/components/messages/CreateOrder/payload`, and `#/components/messages/CreateOrder/examples/0/payload`. | SEND uses Required semantics. The same adapters select direct JSON; required members become `yes`; the array item schema becomes `items[]`; JSON Schema bounds and patterns remain explicit constraints; closed objects forbid additional properties. |
| Reply `OrderAccepted` | Opposite of AsyncAPI `#/operations/sendCreateOrder/action`, with selection from `#/operations/sendCreateOrder/reply/messages`. | `#/components/messages/OrderAccepted/headers`, `#/components/messages/OrderAccepted/payload`, and `#/components/messages/OrderAccepted/examples/0/payload`. | The reply uses RECEIVE Presence semantics. Direct JSON, non-nullability, required-member presence, closed-object rules, formats, patterns, constants, and the source example are preserved. |

Kafka logical-header exposure is authorized by behavior `#/protocolsAndBindings/headerEncoding` and `#/protocolsAndBindings/clientExposure`, with the exact adapter target in manifest `#/adapters`. Payload media-type eligibility comes from the AsyncAPI message `contentType` values and the manifest's `payload-wire` and `schema` adapter entries. No runtime schema lookup, invented field, guessed example, or type-only fallback is used.

## Incomplete-State and Known-Absence Audit

| Output state | Evidence | Result |
|---|---|---|
| No `unknown` markers | Both source operations have established routing and message selection; all required convention and behavior inputs are present; every example validates against its projected schema. | `knowledge: complete` for every full-set file. |
| No `unsupported` markers | Manifest adapters cover AsyncAPI `3.1.0`, its schema dialect, Kafka header exposure, and parameterless `application/json`; the selected schemas are finite and directly representable. | `coverage: complete` for every full-set file. |
| No unprojected source operation | AsyncAPI `#/operations` contains exactly `receiveOrderCreated` and `sendCreateOrder`, both present in INDEX and the channel file. | Root omits the optional Unprojected Operations section. |
| Empty workflow and context catalogs | No workflow or reference artifact is part of the selected projection, and no operation contract depends on one. | Workflows and both context columns use `none`. |
| Empty local binding units | The selected AsyncAPI operation and channel objects contain no bindings, and channel addresses contain no parameters. | Operation Bindings and Channel Parameters/Bindings use `none`; API-wide Kafka rules remain in CONVENTIONS. |
| Empty navigation units | No additional related document is known. | Related uses navigation-only `none` without changing contract completeness. |

## Checker Boundary

`tools/tests/document-set.test.mjs` loads the real `valid/full/` closed root with whole-set validation. It checks the source catalog IDs, operation routing, message and reply identities, all convention states, exact failure rows sourced from `storefront-behavior.json`, the absence of incomplete markers, and the final identity digest.

The checker does not claim to regenerate every sentence from source. Human review remains responsible for confirming that convention prose, operation purposes, field meanings, direction-sensitive Required/Presence mappings, known-absence decisions, and this matrix preserve source semantics without adding client-visible facts.

## Completeness Result

Every client-visible fact in the contract-complete full set is accounted for by the two authoritative sources or the explicit projection manifest and normalized-format derivations identified above. The focused inputs are excluded from this result. No README example, test helper, traversal order, or source prose instruction is treated as additional contract authority.

## Refresh Rule

If a main source, projection-manifest byte, or client-visible full-set fact changes, update this audit, rerun the source and whole-set contract tests, and restamp the full set. Documentation-only edits to this file or the version README do not change the closed document-set identity.
