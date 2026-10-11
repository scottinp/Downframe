# Plan: Downframe MVP

Builds [SPEC.md](../SPEC.md). Tasks: [todo.md](todo.md).

## Order

```
scaffold → detect → patch + CLI → manual AE tests (GATE) → convert() → page → deploy
```

The spike code is the real converter, not throwaway: `scripts/patch.ts` calls `src/converter/`, so passing the gate leaves working, tested code behind.

## Risks

| Risk | Mitigation |
|---|---|
| Version isn't stored in one simple place, or patching it isn't enough for AE | Found by task 3 before any UI exists; stop at the gate |
| Output opens but is subtly wrong | Byte-diff test, plus the experimental label |

## Open questions (needed by task 2)

1. Which AE versions are installed?
2. Version labels: "After Effects 2024 (24.x)" OK?
