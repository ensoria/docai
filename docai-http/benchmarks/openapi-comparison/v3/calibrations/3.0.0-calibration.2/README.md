# OpenAPI Comparison v3 Calibration 2

`3.0.0-calibration.2` is a distinct calibration package for the OpenAPI
comparison benchmark. It preserves the fixed 24-request calibration matrix
while establishing a new immutable runtime and evidence boundary.

The package evaluates one `complete-commerce` API, two tasks, three provider
targets, one repetition, and four context conditions. Exact model IDs remain
unset until a later catalog-verification and freeze step. No provider request
is authorized by this draft.

`plan.json` defines the machine-readable draft identity. The local `runtime/`
directory contains package-owned scheduling, validation, context, and prompt
code; it does not import or execute mutable calibration runtime code from
elsewhere. Context generation invokes Ruby/Psych as an external generation
dependency. It reads the Stable OpenAPI file as bytes, rejects explicit tags,
and uses `Psych.safe_load` with no permitted classes, symbols, or aliases.
Task 6 must record the exact Ruby executable identity, `RUBY_DESCRIPTION`, and
`Psych::VERSION` in the freeze boundary before this package is frozen. Task 2
was verified with Ruby 2.6.10p210 and Psych 3.1.0; those versions are not frozen
until Task 6 records them.

`private/` is reserved for later approved prompt, response, run, checkpoint,
and adjudication artifacts. Generation requires real, non-group/other-writable
package ancestry and current-user-owned private directories. It normalizes the
private root and output directories to mode `0700`; final files use `0600`.
Static no-follow checks and `O_NOFOLLOW` are used where supported. Concurrent
pathname mutation by another process running as the same OS user is prohibited
during generation and is outside the runner threat model; these controls do
not claim immunity from same-user pathname races.
