# invalid: metadata unknown escape

Expected: invalid complete candidate. Metadata stamp values may escape only `\` and `|`; an unknown escape sequence makes the stamp invalid.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | x-note: bad\qescape

# API Index
````
