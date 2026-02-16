# Professional MMO Baseline

## Scope
This baseline is for stabilizing the existing game, not adding features.

## Non-Negotiable Standards
- Server authority first: gameplay state is authoritative on server.
- Single source of truth for inbound network message types:
  - `shared/NetworkMessageCatalog.cjs`
- Validation at boundary:
  - schema/content validation in `server/core/InputValidator.cjs`
  - intent/permission validation in `shared/SecurityBoundary.cjs`
- No silent contract drift:
  - `tools/quality/check-network-contracts.cjs` must pass.

## Quality Gate
- Local:
  - `npm run quality:contracts`
  - `npm run quality:typecheck`
- CI:
  - `.github/workflows/quality-gate.yml`
  - job fails if contract or typecheck fails.

## Definition Of Done (Stability Work)
- Change is isolated and small.
- No duplicated contract updates across files.
- Quality gate passes locally and in CI.
- Changelog entry exists only when player-facing behavior changes.

## Release Discipline
- Tag before deploy.
- Deploy only after quality gate is green.
- If hotfix is needed, prefer forward fix over branch history rewrites.
