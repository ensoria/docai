# invalid: behavior unknown missing marker

Expected: invalid complete candidate. Behavior key values of `unknown` require a following `**unknown**:` marker.

````markdown
### Behavior

- side_effects: unknown
- idempotency: unknown
- preconditions: none
- authorization: `users:write` scope
````
