# invalid: whole-section unknown marker not immediate

Expected: invalid. Whole-section `unknown` must be followed immediately by `**unknown**:`.

```markdown
### Response 200

unknown

Additional prose.

**unknown**: response body and headers are not documented; requires source response contract
```
