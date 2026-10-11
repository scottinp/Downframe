# Constraints

Failing checks block handing work back. Never weaken a rule to make a change pass: no lowered budgets, skipped/deleted tests, `@ts-ignore`, or `it.skip`. To change a rule, ask the user and record why here.

## Floor
| Rule | Command | Why |
|---|---|---|
| Types pass (strict) | `npm run check:fast` | Catches most mistakes in seconds. |
| Tests pass | `npm test` | Converter must never write a file AE rejects. |
| Build passes | `npm run build` | What ships is the build. |

## Enforced (`npm run check:task`, ~5 s, budget 30 s)
| Rule | Limit | Today (2026-10-11) | Why |
|---|---|---|---|
| JS gzip | ≤ 3000 B | 2888 | Today's value plus noise room; page is a small single tool. |
| CSS gzip | ≤ 2500 B | 2378 | Same. |
| dist total raw | ≤ 66000 B | 64595 | Catches a large new image or font. |
| Built `index.html` has CSP `connect-src 'none'` | present | present | Guarantees file bytes can't be sent anywhere. |

Size and CSP: `scripts/check-dist.ts` (budgets live there; keep both in sync).

## Review / before deploy (`npm run check:full`)
| Rule | Command | Today | Why |
|---|---|---|---|
| No known vulnerable deps | `npm audit` | 0 | Dev deps only, but they run the build. |

## Exceptions
| What | Why | Owner | Expires |
|---|---|---|---|
| No secret scanning | No backend, no keys; avoided a new tool. Add gitleaks if a key ever lands. | scottinp | 2027-04-11 |
| No lint | tsc strict covers it for a repo this size. | scottinp | 2027-04-11 |
| No accessibility/Lighthouse | Needs a running URL; check by hand at deploy. | scottinp | 2027-04-11 |
