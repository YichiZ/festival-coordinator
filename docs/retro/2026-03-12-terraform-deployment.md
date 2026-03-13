# Lessons Learned: Terraform Deployment (2026-03-12)

Retrospective on deploying Festival Coordinator to AWS using the plan in `docs/plan/2026-03-12-terraform-deployment.md`.

---

## What Went Wrong (and Why)

### 1. `uv sync` failed inside Docker — missing `[tool.uv] package = false`

**Plan said:** `RUN uv sync --frozen --no-dev`

**What happened:** Docker build failed with `Missing workspace member festival-coordinator`. When `pyproject.toml` has a `[project]` table, uv treats the directory as an installable package and tries to install it as a workspace member. Since there's no actual Python package to install, it errors out.

**Fix:** Add `[tool.uv] package = false` to `pyproject.toml` and use `--no-install-project` flag.

**Lesson:** When using uv in Docker for a scripts-only repo (not a library), always add `[tool.uv] package = false`. This should have been in the plan.

---

### 2. Docker images built on Apple Silicon (ARM64) → App Runner health check fails silently

**Plan said:** `FROM python:3.13-slim` (no platform specified)

**What happened:** Images built on M-series Macs default to `linux/arm64`. App Runner runs `linux/amd64` only. The service pulled the image successfully, started the container, but the health check failed with no clear error — just "your application stopped or failed to start."

**Fix:** Add `--platform linux/amd64` to every `docker build` command and `FROM --platform=linux/amd64` to every Dockerfile.

**Lesson:** Always specify `--platform linux/amd64` when building for App Runner (or any AWS compute). The silent health-check failure with no arch mismatch message in the logs is a painful gotcha. The plan's Dockerfiles should have included the platform directive.

---

### 3. App Runner `min_size = 0` (scale-to-zero) is not supported

**Plan said:** `variable "min_size" { default = 0 }` — intending scale-to-zero to save cost

**What happened:** `terraform apply` failed: `InvalidRequestException: minSize must be at least 1`.

**Fix:** Change default to `1`. Scale-to-zero is not an App Runner feature as of 2026 — only pausing/resuming services achieves zero cost at idle.

**Lesson:** The cost estimate in the plan assumed scale-to-zero behavior that App Runner doesn't support. The actual minimum cost is higher (one always-running instance per service). The plan's cost table needs correcting.

---

### 4. App Runner requires a separate ECR access role (not just an instance role)

**Plan said:** One IAM role (`tasks.apprunner.amazonaws.com`) for the service.

**What happened:** `terraform apply` failed: `Authentication configuration is invalid`. App Runner needs two separate IAM roles:
- An **access role** trusted by `build.apprunner.amazonaws.com` with `AWSAppRunnerServicePolicyForECRAccess` — used to pull the image from ECR
- An **instance role** trusted by `tasks.apprunner.amazonaws.com` — used at runtime (e.g. to read Secrets Manager)

The plan only created the instance role and omitted the `authentication_configuration` block in `source_configuration`.

**Fix:** Add `aws_iam_role.apprunner_access` + `aws_iam_role_policy_attachment.ecr_access` and wire it into `authentication_configuration { access_role_arn }`.

**Lesson:** The App Runner Terraform module in the plan was incomplete. Always check the provider docs for required IAM split between build-time (ECR pull) and runtime roles.

---

### 5. Auto-scaling configuration name must be ≤ 32 characters

**Plan said:** `auto_scaling_configuration_name = var.name`

**What happened:** `terraform apply` failed: name `festival-coordinator-backend-production` (40 chars) exceeds the 32-character limit.

**Fix:** `substr(var.name, 0, 32)`.

**Lesson:** AWS resource name length limits should be accounted for in module design, especially when names are derived from a longer base pattern like `{project}-{service}-{env}`.

---

### 6. Bot service crashed on startup — missing `ENABLE_TRACING` env var

**Plan said:** Bot module had no `env_vars` block (env vars for bot not considered).

**What happened:** Service deployed successfully, but exited with code 1. App Runner log showed `KeyError: 'ENABLE_TRACING'` — `bot.py` uses `os.environ["ENABLE_TRACING"]` which raises if the key is absent.

**Fix:** Add `env_vars = { ENABLE_TRACING = "false" }` to the bot module call in `infra/main.tf`.

**Lesson:** All required env vars (not just secrets) must be inventoried before deploy. The plan listed secrets flowing through Secrets Manager but didn't audit plain env vars. A pre-deploy checklist comparing `os.environ[...]` calls in app code against the Terraform config would catch this.

---

### 7. Bot `CMD` didn't bind to `0.0.0.0` — service not accessible

**Plan said:** `CMD ["uv", "run", "python", "bot.py", "-t", "twilio"]`

**What happened:** App Runner health check on TCP port 8080 failed. The bot was starting but only binding to `localhost` (127.0.0.1), not the container's network interface.

**Fix:** `CMD ["uv", "run", "python", "bot.py", "-t", "twilio", "--host", "0.0.0.0", "--port", "8080"]`

**Lesson:** Any service running in a container must explicitly bind to `0.0.0.0`. Localhost-only binding works for local dev but is invisible to App Runner's health checker. This should be tested locally with `docker run -p 8080:8080 ...` and `curl localhost:8080` before pushing.

---

### 8. `schema.sql` missing from bot Docker COPY

**Plan said:** `COPY bot.py tools.py db.py ./`

**What happened:** The bot crashed at runtime because `db.py` tries to open `schema.sql` at import time and the file wasn't in the image.

**Fix:** `COPY bot.py tools.py db.py schema.sql ./`

**Lesson:** When writing Dockerfiles, grep the codebase for every `open(...)` and file path reference — don't just copy the entry-point files. The plan didn't account for runtime file dependencies.

---

### 9. AWS SSO tokens expire mid-`terraform apply` (~15 min TTL)

**Plan said:** "Terraform apply" as a single step, no mention of credential expiry.

**What happened:** `terraform apply` succeeds in submitting operations to AWS but the wait loop (polling until services reach `RUNNING`) takes 5–10 minutes. By the time the bot service finished deploying, the session token had expired, Terraform couldn't poll status, and reported a failure — even though the deployment had succeeded in AWS.

This caused Terraform state to diverge: resources existed in AWS but Terraform thought they were failed/missing, leading to "service already exists" errors on the next `apply`.

**Fix (operational):** Re-export credentials with `eval $(aws configure export-credentials --format env)` before every `terraform apply`. If the apply fails mid-wait due to token expiry, check actual AWS service status, then `terraform import` or `terraform untaint` to resync state.

**Fix (structural):** Use remote state (S3 backend) and run Terraform from a CI environment with long-lived credentials (IAM role via OIDC, not SSO) so token expiry is never a factor.

**Lesson:** SSO short-lived credentials are incompatible with long-running Terraform waits. The plan should have flagged this and recommended either a local `terraform.tfvars` with role-chaining or running the first apply from CI where OIDC roles don't expire.

---

### 10. Terraform state drift from partial applies

**Related to #9.** When `terraform apply` is interrupted (by token expiry, manual cancel, or error), some resources are created in AWS but not recorded in state — or recorded as tainted. Subsequent applies then fail with "resource already exists" since Terraform tries to create a resource that's already there.

**Recovery pattern used:**
1. `terraform state rm <resource>` — remove orphaned state entries
2. `terraform import <resource> <arn>` — re-adopt existing AWS resources
3. `terraform untaint <resource>` — clear taint on resources that are actually healthy

**Lesson:** Terraform is not crash-safe for stateful create operations. Use S3 remote state + DynamoDB locking so state is never left in a partial condition across machines or retries.

---

## What the Plan Got Right

- Module structure (`secrets`, `apprunner`, `frontend`) was clean and reusable
- Secrets Manager as the secret injection mechanism was the right call
- CloudFront OAC + S3 bucket policy was correct and secure (no public S3)
- SPA 404→200 fallback in CloudFront was remembered
- GitHub Actions OIDC (no long-lived keys) was the right CI/CD design
- Cost estimates were directionally correct (slightly off due to min_size=1 constraint)

---

## Checklist for Next Deployment

Before running `terraform apply` on a fresh environment:

- [ ] `[tool.uv] package = false` in `pyproject.toml`
- [ ] All Dockerfiles have `FROM --platform=linux/amd64`
- [ ] All services bind to `0.0.0.0` with explicit `--host` and `--port` in CMD
- [ ] All files referenced at runtime (schema.sql, etc.) are in the Docker COPY
- [ ] All `os.environ[...]` calls in app code have a corresponding env_var or secret in Terraform
- [ ] `min_size = 1` (not 0) in App Runner module
- [ ] Auto-scaling config name is ≤ 32 chars
- [ ] App Runner module includes both the ECR access role and instance role
- [ ] AWS credentials are fresh (`eval $(aws configure export-credentials --format env)`) immediately before `terraform apply`
- [ ] Remote state backend (S3 + DynamoDB) is configured before running in production
