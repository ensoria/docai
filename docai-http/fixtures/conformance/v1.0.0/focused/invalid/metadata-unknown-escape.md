# invalid: metadata unknown escape

Expected: invalid complete conformance. Metadata stamp values may escape only `\` and `|`; an unknown escape sequence makes the stamp invalid.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: conformance-full-20260710-001 | projection_id: conformance-20260710-001 | source: fixtures/conformance/v1.0.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | x-note: bad\qescape

# API Index
````
