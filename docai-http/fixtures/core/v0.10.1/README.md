# DocAI HTTP 0.10.1 Compatibility Core Fixtures

This directory contains the initial Compatibility Core fixture corpus for DocAI HTTP draft `0.10.1`.

- `valid/full/` is a full-profile document set that exercises the core read path: `INDEX.md` -> `CONVENTIONS.md` -> `resources/users.md`.
- `focused/valid/` contains small valid snippets for individual core syntax rules.
- `focused/invalid/` contains small invalid snippets for validator negative tests.

This corpus intentionally excludes non-core draft features such as the compact profile, workflows, webhooks, non-JSON bodies, selective convention loading, and token-routing metadata.
