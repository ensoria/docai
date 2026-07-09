# invalid: unsupported replacement unit outside core

Expected: invalid. The core fixture checker rejects replacement units that belong only to non-core workflow, webhook, compact, non-JSON, response-header-only, or other advanced structures.

```markdown
## Steps

**unsupported**: replaces workflow Steps: workflow step graph requires source fallback at fixtures/core-openapi.yaml#/x-workflows/user-onboarding
```
