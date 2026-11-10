# Calibration 3 Artifact Contract

Stopped-resume corrections passed Task 2 review; execute CLI clock and
opaque verified-report corrections passed Task 3 review. Task 4 establishes
the new November 10, 2026 trust anchor and freeze. Publication is verified by
the plan/manifest pair, not this document. Whole-package review and explicit
Live approval are separate requirements.

This contract defines the immutable boundary for
`3.0.0-calibration.3`. Its freeze binds the plan, package-local runtime,
canonical schedule, evidence verifier, retained inputs, model resolutions,
cost estimate, and manifest under this one identity. The manifest itself is
not an execution authorization.

## Runtime Boundary

All calibration runtime modules are owned by this package and are frozen with
it. They must not import mutable runtime modules from another calibration.
Stable `1.0.0` conformance inputs may be read only through explicit paths and
hashes recorded in the package manifest.

OpenAPI slicing has one external generation dependency: Ruby with Psych and
the JSON standard library. The package reads YAML source bytes, rejects every
explicit YAML tag, and calls `Psych.safe_load` with empty permitted class and
symbol lists and aliases disabled. The manifest records the resolved Ruby
executable identity, its `RUBY_DESCRIPTION`, and `Psych::VERSION`; generation
on another dependency identity cannot establish byte reproduction without a
new verification and freeze decision. No old benchmark runtime is imported or
executed by this subprocess.

## Evidence Boundary

The evidence verifier derives complete terminal run records from the
retained response attempt, canonical prompt and task packet, plan, parser,
grader, and runner revision. It compares that record with retained run data
using strict plain-JSON equality. A response/run mismatch fails closed before
resume, reporting, gate evaluation, or another provider call.

## Private Artifacts

Private prompts, context metrics, responses, run records, checkpoints, and
adjudication records belong only below `private/`. They are ignored except for
`private/README.md`. Public checks may tolerate absent ignored private files;
future Live preflight must require and hash-check the private inputs it uses.

Prompt generation uses a trusted-directory precondition. Existing ancestry
through the package directory must consist of real directories with no group
or other write bits. Existing private directories must be owned by the current
user when the platform exposes user IDs, must not be group/other writable, and
are normalized to mode `0700`; newly created private directories use `0700`.
Final private files use `0600`. The writer retains static symlink checks, uses
exclusive temporary creation, applies `O_NOFOLLOW` where supported, validates
opened descriptors and inode identity, and atomically renames each file.

Generation must run without concurrent pathname mutation by another process
under the same OS user. Such same-user mutation is prohibited and outside the
runner threat model. The pathname-based checks and renames do not provide or
claim race immunity against that actor. Prompt and metrics replacement is
atomic per file, not transactionally atomic as a pair.

The manifest also binds static transitive test-helper imports and re-exports.
Missing dependencies fail collection; changed, removed or newly imported
dependencies fail verification. All package runtime files are included,
including modules selected dynamically by the versioned CLIs.

Publication retains exclusive locking, manifest-first durable installation,
no-replace installation, setup-failure cleanup and full normalized plan
commitment. There is no repair or rebaseline command. A manifested defect
after publication requires a new identity, not an updated seal.

No part of this packet authorizes a provider request.
