# DocAI Messaging Fixtures

This directory contains the versioned DocAI Messaging conformance corpus. Each
version directory fixes the corpus contract for one published DocAI Messaging
version and publication scope.

`valid/` contains complete document sets that a checker must accept.
`focused/valid/` and `focused/invalid/` contain small, isolated cases for one
structure or rule; invalid cases identify their expected primary rule IDs in
`cases.json`. `source/` contains synthetic authoritative inputs and projection
inputs used to explain or reproduce a fixture. Evidence files record coverage,
traceability, and any required measured claims.

The checker is a corpus expectation checker. It evaluates a fixture against its
declared expectation; it is not a public validator, a generator, or an
AsyncAPI-to-DocAI converter.

Published fixtures are immutable. A semantic change is published in a new
version directory rather than modifying an existing versioned corpus.
