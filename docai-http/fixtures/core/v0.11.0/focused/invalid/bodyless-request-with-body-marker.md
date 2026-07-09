# invalid: body-less request with body marker

Expected: invalid. A request body that is `none` must not include body representation markers.

```markdown
#### Body

none

**body_required**: no
```
