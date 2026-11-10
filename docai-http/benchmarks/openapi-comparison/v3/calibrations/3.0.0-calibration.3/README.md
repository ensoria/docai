# OpenAPI Comparison v3 Calibration 3

`3.0.0-calibration.3` is a distinct calibration package for the OpenAPI
comparison benchmark. It preserves the fixed 24-request calibration matrix
while establishing a new immutable runtime and evidence boundary.

## Publication Status

Stopped-resume and fatal crash-recovery corrections passed Task 2 review.
Execute CLI clock wiring and opaque verified-report closure passed Task 3
review with 224 tests. Task 4 resolves the exact current model/cost packet,
regenerates private inputs, and publishes the one-time November 10, 2026
freeze. `plan.json` and `freeze-manifest.json` are the publication authority;
run the checks below before relying on this package. Task 5 whole-package
review and separate explicit Live approval remain required. No Live execution
or result/adoption claim is authorized by the freeze.

The approved model panel is OpenAI `gpt-5.6-sol`, Anthropic `claude-sonnet-5`,
and Google `gemini-3.8-flash`, checked against public documentation on
2026-11-10. See `MODEL-COST-PREFLIGHT.md` for rates, expiry dates, settings,
estimation limits and reported-usage stop thresholds. No prior
seal, manifest, model resolution, cost packet, or private evidence is inherited.

The package evaluates one `complete-commerce` API, two tasks, three provider
targets, one repetition, and four context conditions. The frozen plan binds
the exact three model IDs. No provider request is authorized by this packet.

`plan.json` defines the machine-readable identity. The local `runtime/`
directory contains package-owned scheduling, validation, context, and prompt
code; it does not import or execute mutable calibration runtime code from
elsewhere. Context generation invokes Ruby/Psych as an external generation
dependency. It reads the Stable OpenAPI file as bytes, rejects explicit tags,
and uses `Psych.safe_load` with no permitted classes, symbols, or aliases.
The manifest records the exact Ruby executable identity, `RUBY_DESCRIPTION`,
and `Psych::VERSION`. Historical integrity does not establish current account
access, catalog availability or permission to execute.

## Native Checks

From the repository root, using the versioned runtime (no wrapper required):

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-plan.mjs --frozen
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-plan.mjs --frozen --private-required
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/freeze.mjs --check --private-required
```

Public integrity checks tolerate absent ignored private inputs. They do not
establish Live readiness. Private-required checks must pass before approval.
The freeze collector uses Node's V8 ESM parser in a non-evaluating subprocess
to bind static import/re-export closure, including test helpers. Runtime
dynamic imports address the already-bound package runtime; synthetic test
packages and injected fake transports are not production bypasses.

`private/` is reserved for later approved prompt, response, run, checkpoint,
and adjudication artifacts. Generation requires real, non-group/other-writable
package ancestry and current-user-owned private directories. It normalizes the
private root and output directories to mode `0700`; final files use `0600`.
Static no-follow checks and `O_NOFOLLOW` are used where supported. Concurrent
pathname mutation by another process running as the same OS user is prohibited
during generation and is outside the runner threat model; these controls do
not claim immunity from same-user pathname races.
