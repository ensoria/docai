# DocAI Messaging Complete Candidate 0.17.1

This directory is a work-in-progress complete generator surface candidate. It is not a release artifact or an implementation-target publication.

The current candidate contains a whole-set-valid full/compact profile pair, overlapping Source and Operation Shards with exact and fallback retrieval boundaries, source-backed required and supplemental direct Workflows, separate Workflow files covering every section's expanded, none, whole-section unknown, and replacement unsupported states, supplemental Reference Material with fixed no-authority grammar, BOM/CRLF normalization, preserved decomposed Unicode, and minimal embedded-backtick fence selection, source-backed tagged and untagged JSON variants, an authoritatively opaque raw-binary representation, and an adapter-defined `text/csv;charset=utf-8` representation selected by an exact publication-scope mapping. The CSV full and compact examples intentionally use different valid renderings and compare through the trusted adapter's decoded-value model. The compact profile additionally uses one-line JSON, `field_defaults`, a backward same-file `same_as` reference with a discoverable channel-file retrieval unit, and dependency-closed convention selectors with the required supplemental/direct Workflow fallbacks. The explicit projection-input manifest binds the source and adapter rules and stamps both roots. The unknown and unsupported Workflow cases intentionally aggregate the root to `knowledge: requires-input` and `coverage: requires-source`; unrelated operation retrieval remains context-free. Task 12 will continue with complete-structure source traceability. Task 13 will add the focused corpus, coverage matrix, and evidence gates.

Validate the current pair without modifying it:

```sh
node docai-messaging/tools/check-complete-fixtures.mjs
```
