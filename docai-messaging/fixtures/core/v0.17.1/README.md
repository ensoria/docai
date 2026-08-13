# DocAI Messaging Core v0.17.1 fixtures

This corpus fixes the Compatibility Core projection inputs and generated document sets for DocAI Messaging v0.17.1. Files under `source/focused/` are independent edge-case inputs and do not contribute to the contract-complete main projection.

## Projection-input manifest

`source/projection-input-manifest.json` is the complete profile-independent snapshot used to derive the main projection identity. Its `sources` array contains only `storefront.asyncapi.json` and `storefront-behavior.json`; each `sha256` value covers the exact bytes of the named file. The manifest also fixes the source-application perspective, fact-domain precedence, empty counterpart-mapping and stable-name-override sets, exact adapter rule versions, generator version, and publication-policy identity. Array order is significant where stated below and is therefore part of the projection identity.

Serialize the manifest canonically as follows:

1. Encode one JSON object as UTF-8 without a byte-order mark.
2. Use only the fixed ASCII member names shown by the manifest schema and recursively order every object's member names by ascending UTF-8 byte order.
3. Emit `adapters` in ascending `(class, target, ruleVersion)` order, `precedence` in ascending `factDomain` order, and `sources` in ascending `sourceId` order. A precedence entry's `sourceOrder` remains semantic priority order from highest to lowest and must not be re-sorted.
4. Preserve all other array order, including an empty array, exactly as configured.
5. Use compact JSON with no insignificant whitespace, then append exactly one LF byte. Do not emit CR, trailing whitespace, or additional lines.

The SHA-256 digest of those exact manifest bytes becomes `projection_digest`; `projection_id` is derived from that digest by the normal DocAI Messaging identity rule. Generation time, run identity, output profile, and focused-source inputs are intentionally absent because they do not belong to this profile-independent projection snapshot.
