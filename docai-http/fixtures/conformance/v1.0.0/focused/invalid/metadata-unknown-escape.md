# invalid: metadata unknown escape

Expected: invalid complete conformance. Metadata stamp values may escape only `\` and `|`; an unknown escape sequence makes the stamp invalid.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | x-note: bad\qescape

# API Index
````
