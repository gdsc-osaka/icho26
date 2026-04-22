---
name: coding-rules
description: Coding conventions and implementation constraints for this project. Enforces Feature First + Ports and Adapters architecture, Cloudflare Workers + React Router v7 patterns, D1/KV responsibilities, and API consistency from specs. Always follow when writing code.
user-invocable: false
disable-model-invocation: false
allowed-tools: Read, Grep, Glob
---

# Coding Rules
* Keep implementations aligned with `specs/` and do not change fixed stack decisions.
* Runtime and framework are fixed: Cloudflare Workers + React Router v7 (Framework Mode) + TypeScript.
* Use Feature First + Ports and Adapters layout under `app/modules/<feature>/`.
* Keep route handlers thin: validate input -> call usecase -> map response.
* Do not write business transition logic in route handlers.
* Keep domain pure: no D1/KV/Cloudflare SDK/zod dependency in `domain`.
* Use `.server.ts` suffix for infrastructure, composition, and Workers-bound code.
* D1 is source of truth; KV is cache/session/config only.
* Never store progress source-of-truth or idempotency source-of-truth in KV.

## Directory and dependency rules

* Follow the structure defined in `specs/04-application-skeleton-and-dependency-injection.md`.
* Dependency direction must be `routes -> application -> domain`.
* Separate ports into:
  * `application/ports/driving` (inbound usecase contract)
  * `application/ports/driven` (outbound repository/external contract)
* `domain` must not import `infrastructure` or other features directly.
* Avoid creating ambiguous directories like `services/`.

## Data and transaction rules

* All update APIs run with D1 transaction semantics.
* Enforce optimistic concurrency with `users.state_version`.
* For progress/operator update APIs, require `X-Idempotency-Key` and persist response in `idempotency_keys`.
* On conditional update failure, return `CONFLICT_STATE` (HTTP 409).
* Keep `idempotency_keys` retention at 30 days.

## API and error rules

* Keep API prefix under `/api/v1/`.
* Validate all request payloads and params with zod in route layer.
* Use fixed error codes only:
  * `BAD_REQUEST`
  * `UNAUTHORIZED`
  * `FORBIDDEN`
  * `NOT_FOUND`
  * `CONFLICT_STATE`
  * `INTERNAL_ERROR`
* Standardize error response around a shared `AppError` shape.

## Authorization rules

* Use RBAC with two roles: `participant`, `operator`.
* Do not split usecase directory by actor name.
* Evaluate authorization policy inside usecases (policy in `modules/<feature>/authorization/policies.ts`).

## Testing and delivery rules

* Add or update tests for every behavior change (unit/integration/e2e as appropriate).
* Preserve key acceptance checks:
  * Q1 order is fixed after first decision
  * Unlocked-stage constraints return `CONFLICT_STATE`
  * Idempotency and `state_version` conflict behavior are covered
* CI must keep `typecheck`, tests, and Terraform plan green.