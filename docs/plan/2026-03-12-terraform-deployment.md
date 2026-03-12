# Terraform Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Required skills — STOP if any are missing:**
> - `terraform-skill@antonbabenko` — Terraform best practices, module structure, testing strategy. Install: `/plugin install terraform-skill@antonbabenko`
> - `terminalskills-skills-aws-cli` — AWS CLI patterns for ECR, App Runner, IAM, and Secrets Manager. Already bundled in `.claude/skills/`. If missing: `npx -y @lobehub/market-cli skills install terminalskills-skills-aws-cli`
>
> Invoke both skills before writing or reviewing any Terraform or AWS CLI commands in this plan.

**Goal:** Deploy all Festival Coordinator services to AWS using Terraform, replacing manual App Runner setup with reproducible infrastructure-as-code.

**Architecture:** Terraform manages three AWS App Runner services (FastAPI backend, voice bot) plus S3+CloudFront for the React frontend. Secrets are stored in AWS Secrets Manager and injected into App Runner at runtime. Supabase (cloud) remains the database — no change needed there.

**Tech Stack:** Terraform ~> 1.5 (1.5.7 via Homebrew), AWS App Runner, AWS S3 + CloudFront, AWS Secrets Manager, AWS ECR (container registry), AWS IAM, Docker, GitHub Actions (CI/CD)

---

## Cost Estimate

All prices are AWS us-east-1 as of 2026. Assumes light/moderate usage typical for a small friend-group app.

### App Runner (per service)

App Runner charges for **provisioned compute** (when paused/idle) + **active compute** (while handling requests).


| Mode                       | Rate                               |
| -------------------------- | ---------------------------------- |
| Provisioned (idle)         | $0.007 / vCPU-hr · $0.0008 / GB-hr |
| Active (handling requests) | $0.064 / vCPU-hr · $0.008 / GB-hr  |


**Backend service** (0.25 vCPU / 0.5 GB, scale-to-zero, ~2 hrs active/day):

- Active: 2 hr × 0.25 × $0.064 + 2 hr × 0.5 × $0.008 = ~~$0.04/day → **~~$1.20/mo**
- Idle: $0 (scale-to-zero, min_size = 0)
- **Backend total: ~$1–2/mo**

**Bot service** (1 vCPU / 2 GB, scale-to-zero, low usage — only during calls):

- PyTorch + Silero VAD require at least 1.5 GB RAM and meaningful CPU
- Active during calls only: **~$3–5/mo**
- Idle: $0 (scale-to-zero, min_size = 0)

**Both App Runner services: ~$5/mo**

### S3 + CloudFront (frontend)


| Item                           | Cost                   |
| ------------------------------ | ---------------------- |
| S3 storage (React build ~5 MB) | ~$0.00/mo (negligible) |
| CloudFront — 1 GB transfer/mo  | ~$0.085                |
| CloudFront — 10K requests/mo   | ~$0.01                 |
| **Frontend total**             | **~$0.10/mo**          |


### Secrets Manager

6 secrets × $0.40/secret/mo = **~$2.40/mo**
(+ $0.05 per 10K API calls — negligible)

### ECR (container registry)

First 500 MB/mo free. Two small images (~~200 MB each) = **~~$0/mo** within free tier.

### Summary


| Service                                                  | Monthly Cost  |
| -------------------------------------------------------- | ------------- |
| App Runner — backend (0.25 vCPU / 0.5 GB, scale-to-zero) | ~$1–2         |
| App Runner — bot (1 vCPU / 2 GB, scale-to-zero)          | ~$3–5         |
| S3 + CloudFront — frontend                               | ~$0.10        |
| Secrets Manager                                          | ~$2.40        |
| ECR                                                      | ~$0.00        |
| **Total**                                                | **~$7–10/mo** |


### Cost-saving options

- **Pause bot service when not in use** → drops to ~$1.50/mo (provisioned only)
  ```bash
  aws apprunner pause-service --service-arn <arn>
  aws apprunner resume-service --service-arn <arn>
  ```
- **Use `PAUSED` state for backend overnight** → saves ~$8/mo
- **Minimum at full pause:** ~$2.50/mo (secrets only + negligible storage)

---

## File Structure

```
infra/
  main.tf                  # Root module: provider, backend config
  variables.tf             # Input variables (region, env, image tags)
  outputs.tf               # Outputs: URLs for all services
  terraform.tfvars.example # Example var values (committed, no secrets)

  modules/
    apprunner/
      main.tf              # App Runner service + IAM role
      variables.tf
      outputs.tf

    frontend/
      main.tf              # S3 bucket + CloudFront distribution
      variables.tf
      outputs.tf

    secrets/
      main.tf              # Secrets Manager secrets
      variables.tf
      outputs.tf

.github/
  workflows/
    deploy.yml             # CI: build images → push ECR → terraform apply

Dockerfile.backend         # FastAPI backend container
Dockerfile.bot             # Voice bot container
backend/main.py            # Fix CORS to accept production frontend URL
```

---

## Chunk 1: Dockerfiles and CORS fix

### Task 1: Dockerfile for FastAPI backend

**Files:**

- Create: `Dockerfile.backend`
- Modify: `backend/main.py` (CORS origins)
- [x] **Step 1: Create `Dockerfile.backend`**

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./backend/
EXPOSE 8000
CMD ["uv", "run", "fastapi", "run", "backend/main.py", "--host", "0.0.0.0", "--port", "8000"]
```

- [x] **Step 2: Fix CORS in `backend/main.py`**

Replace hardcoded `http://localhost:5173` with env-driven origins:

```python
import os

_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 3: Build and smoke-test locally**

```bash
docker build -f Dockerfile.backend -t festival-backend:local .
docker run --env-file .env -p 8000:8000 festival-backend:local
curl http://localhost:8000/groups
```

Expected: JSON array of groups.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile.backend backend/main.py
git commit -m "feat(infra): add backend Dockerfile and env-driven CORS"
```

---

### Task 2: Dockerfile for voice bot

**Files:**

- Create: `Dockerfile.bot`
- [x] **Step 1: Create `Dockerfile.bot`**

```dockerfile
FROM python:3.13-slim
WORKDIR /app

# ffmpeg required by pydub for audio processing
# torch dependencies pulled by pipecat silero/smart-turn (pytorch not pre-installed on slim)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY bot.py tools.py db.py ./
EXPOSE 8080
CMD ["uv", "run", "python", "bot.py", "-t", "twilio"]
```

- [ ] **Step 2: Build locally**

```bash
docker build -f Dockerfile.bot -t festival-bot:local .
```

Expected: Build succeeds (no need to run — requires Twilio/Daily at runtime).

- [ ] **Step 3: Commit**

```bash
git add Dockerfile.bot
git commit -m "feat(infra): add voice bot Dockerfile"
```

---

## Chunk 2: Terraform modules

### Task 3: Secrets Manager module

**Files:**

- Create: `infra/modules/secrets/main.tf`
- Create: `infra/modules/secrets/variables.tf`
- Create: `infra/modules/secrets/outputs.tf`
- [x] **Step 1: Create `infra/modules/secrets/variables.tf`**

```hcl
variable "env" { type = string }
variable "secrets" {
  type    = map(string)
  default = {}
}
```

- [x] **Step 2: Create `infra/modules/secrets/main.tf`**

```hcl
resource "aws_secretsmanager_secret" "app" {
  for_each = var.secrets
  name     = "festival-coordinator/${var.env}/${each.key}"
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each      = var.secrets
  secret_id     = aws_secretsmanager_secret.app[each.key].id
  secret_string = each.value
}
```

- [x] **Step 3: Create `infra/modules/secrets/outputs.tf`**

```hcl
output "secret_arns" {
  value = { for k, v in aws_secretsmanager_secret.app : k => v.arn }
}
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/secrets/
git commit -m "feat(infra): secrets manager terraform module"
```

---

### Task 4: App Runner module

**Files:**

- Create: `infra/modules/apprunner/main.tf`
- Create: `infra/modules/apprunner/variables.tf`
- Create: `infra/modules/apprunner/outputs.tf`
- [x] **Step 1: Create `infra/modules/apprunner/variables.tf`**

```hcl
variable "name"          { type = string }
variable "image_uri"     { type = string }
variable "port"          { type = number; default = 8000 }
variable "cpu"           { type = string; default = "256" }   # 0.25 vCPU
variable "memory"        { type = string; default = "512" }   # 0.5 GB
variable "min_size"      { type = number; default = 0 }       # scale-to-zero
variable "max_size"      { type = number; default = 1 }
variable "env_vars"      { type = map(string); default = {} }
variable "secret_arns"   { type = map(string); default = {} }
```

- [x] **Step 2: Create `infra/modules/apprunner/main.tf`**

```hcl
resource "aws_iam_role" "apprunner_instance" {
  name = "${var.name}-instance-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "${var.name}-secrets"
  role = aws_iam_role.apprunner_instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = values(var.secret_arns)
    }]
  })
}

resource "aws_apprunner_auto_scaling_configuration_version" "this" {
  auto_scaling_configuration_name = var.name
  min_size        = var.min_size
  max_size        = var.max_size
  max_concurrency = 100
}

resource "aws_apprunner_service" "this" {
  service_name = var.name

  source_configuration {
    image_repository {
      image_identifier      = var.image_uri
      image_repository_type = "ECR"
      image_configuration {
        port = tostring(var.port)
        runtime_environment_variables = var.env_vars
        runtime_environment_secrets   = var.secret_arns
      }
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = var.cpu
    memory            = var.memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.this.arn
}
```

- [x] **Step 3: Create `infra/modules/apprunner/outputs.tf`**

```hcl
output "service_url" { value = "https://${aws_apprunner_service.this.service_url}" }
output "service_arn" { value = aws_apprunner_service.this.arn }
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/apprunner/
git commit -m "feat(infra): app runner terraform module"
```

---

### Task 5: Frontend S3 + CloudFront module

**Files:**

- Create: `infra/modules/frontend/main.tf`
- Create: `infra/modules/frontend/variables.tf`
- Create: `infra/modules/frontend/outputs.tf`
- [x] **Step 1: Create `infra/modules/frontend/variables.tf`**

```hcl
variable "name"          { type = string }
variable "dist_path"     { type = string; default = "../frontend/dist" }
```

- [x] **Step 2: Create `infra/modules/frontend/main.tf`**

```hcl
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.name}-frontend"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls   = true
  block_public_policy = true
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = var.name
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    target_origin_id       = "s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  # SPA fallback: serve index.html for all 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate { cloudfront_default_certificate = true }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
        }
      }
    }]
  })
}
```

- [x] **Step 3: Create `infra/modules/frontend/outputs.tf`**

```hcl
output "cloudfront_url"  { value = "https://${aws_cloudfront_distribution.frontend.domain_name}" }
output "s3_bucket_name"  { value = aws_s3_bucket.frontend.bucket }
output "distribution_id" { value = aws_cloudfront_distribution.frontend.id }
```

- [ ] **Step 4: Commit**

```bash
git add infra/modules/frontend/
git commit -m "feat(infra): s3+cloudfront frontend terraform module"
```

---

## Chunk 3: Root module and CI/CD

### Task 6: Root Terraform module

**Files:**

- Create: `infra/main.tf`
- Create: `infra/variables.tf`
- Create: `infra/outputs.tf`
- Create: `infra/terraform.tfvars.example`
- [x] **Step 1: Create `infra/variables.tf`**

```hcl
variable "aws_region"       { type = string; default = "us-east-1" }
variable "env"               { type = string; default = "production" }
variable "backend_image_uri" { type = string }
variable "bot_image_uri"     { type = string }

# Secrets — pass via TF_VAR_* env vars or CI secrets, never commit values
variable "anthropic_api_key" { type = string; sensitive = true }
variable "cartesia_api_key"  { type = string; sensitive = true }
variable "supabase_url"      { type = string; sensitive = true }
variable "supabase_api_key"  { type = string; sensitive = true }
variable "twilio_account_sid"{ type = string; sensitive = true; default = "" }
variable "twilio_auth_token" { type = string; sensitive = true; default = "" }
variable "twilio_number"     { type = string; default = "" }
```

- [x] **Step 2: Create `infra/main.tf`**

```hcl
terraform {
  required_version = "~> 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  # Uncomment to use S3 remote state:
  # backend "s3" {
  #   bucket = "festival-coordinator-tfstate"
  #   key    = "production/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" { region = var.aws_region }

module "secrets" {
  source = "./modules/secrets"
  env    = var.env
  secrets = {
    ANTHROPIC_API_KEY  = var.anthropic_api_key
    CARTESIA_API_KEY   = var.cartesia_api_key
    SUPABASE_URL       = var.supabase_url
    SUPABASE_API_KEY   = var.supabase_api_key
    TWILIO_ACCOUNT_SID = var.twilio_account_sid
    TWILIO_AUTH_TOKEN  = var.twilio_auth_token
  }
}

module "backend" {
  source      = "./modules/apprunner"
  name        = "festival-coordinator-backend-${var.env}"
  image_uri   = var.backend_image_uri
  port        = 8000
  env_vars    = {
    CORS_ORIGINS = module.frontend.cloudfront_url
  }
  secret_arns = module.secrets.secret_arns
}

module "bot" {
  source      = "./modules/apprunner"
  name        = "festival-coordinator-bot-${var.env}"
  image_uri   = var.bot_image_uri
  port        = 8080
  cpu         = "1024"  # 1 vCPU — PyTorch + Silero VAD + smart turn need real CPU
  memory      = "2048"  # 2 GB — PyTorch model loading requires ~1.5 GB+
  min_size    = 0
  secret_arns = module.secrets.secret_arns
}

module "frontend" {
  source = "./modules/frontend"
  name   = "festival-coordinator-${var.env}"
}
```

- [x] **Step 3: Create `infra/outputs.tf`**

```hcl
output "backend_url"  { value = module.backend.service_url }
output "bot_url"      { value = module.bot.service_url }
output "frontend_url" { value = module.frontend.cloudfront_url }
```

- [x] **Step 4: Create `infra/terraform.tfvars.example`**

```hcl
aws_region = "us-east-1"
env        = "production"

# Set these via TF_VAR_* environment variables — do not commit real values
# backend_image_uri = "123456789.dkr.ecr.us-east-1.amazonaws.com/festival-backend:latest"
# bot_image_uri     = "123456789.dkr.ecr.us-east-1.amazonaws.com/festival-bot:latest"
```

- [x] **Step 5: Validate Terraform config**

```bash
cd infra
terraform init
terraform validate
```

Expected: `Success! The configuration is valid.` ✓ Confirmed with Terraform 1.5.7.

> **Terraform skill review (2026-03-12):** Config reviewed against [antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill). Issues found and fixed:
>
> - `>= 1.7` → `~> 1.5` (1.6+ is BSL-licensed and unavailable via Homebrew; 1.5.7 is the latest open-source release)
> - All variables now have `description` (required by skill)
> - All outputs now have `description`
> - `for_each` blocks now have a blank line after (resource block ordering)
> - IAM policy now uses `count = length(var.secret_arns) > 0 ? 1 : 0` to avoid invalid `"Resource": []` when `secret_arns` is empty

- [ ] **Step 6: Commit**

```bash
git add infra/
git commit -m "feat(infra): root terraform module wiring all services"
```

---

### Task 7: GitHub Actions CI/CD

**Files:**

- Create: `.github/workflows/deploy.yml`
- [x] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push backend image
        run: |
          docker build -f Dockerfile.backend \
            -t $ECR_REGISTRY/festival-backend:${{ github.sha }} \
            -t $ECR_REGISTRY/festival-backend:latest .
          docker push $ECR_REGISTRY/festival-backend:${{ github.sha }}
          docker push $ECR_REGISTRY/festival-backend:latest

      - name: Build and push bot image
        run: |
          docker build -f Dockerfile.bot \
            -t $ECR_REGISTRY/festival-bot:${{ github.sha }} \
            -t $ECR_REGISTRY/festival-bot:latest .
          docker push $ECR_REGISTRY/festival-bot:${{ github.sha }}
          docker push $ECR_REGISTRY/festival-bot:latest

      - name: Build frontend
        run: |
          cd frontend && npm ci && npm run build

      - name: Terraform apply
        working-directory: infra
        env:
          TF_VAR_backend_image_uri: ${{ env.ECR_REGISTRY }}/festival-backend:${{ github.sha }}
          TF_VAR_bot_image_uri: ${{ env.ECR_REGISTRY }}/festival-bot:${{ github.sha }}
          TF_VAR_anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          TF_VAR_cartesia_api_key: ${{ secrets.CARTESIA_API_KEY }}
          TF_VAR_supabase_url: ${{ secrets.SUPABASE_URL }}
          TF_VAR_supabase_api_key: ${{ secrets.SUPABASE_API_KEY }}
          TF_VAR_twilio_account_sid: ${{ secrets.TWILIO_ACCOUNT_SID }}
          TF_VAR_twilio_auth_token: ${{ secrets.TWILIO_AUTH_TOKEN }}
        run: |
          terraform init
          terraform apply -auto-approve

      - name: Deploy frontend to S3
        run: |
          BUCKET=$(cd infra && terraform output -raw s3_bucket_name)
          DIST_ID=$(cd infra && terraform output -raw distribution_id)
          aws s3 sync frontend/dist s3://$BUCKET --delete
          aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

- [ ] **Step 2: Add required GitHub secrets**

In GitHub repo → Settings → Secrets, add:

- `AWS_ACCOUNT_ID`
- `AWS_DEPLOY_ROLE_ARN`
- `ANTHROPIC_API_KEY`
- `CARTESIA_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(infra): github actions deploy workflow"
```

---

## Chunk 4: ECR repositories + first deploy

### Task 8: Create ECR repositories

Run once before first deploy:

- [ ] **Step 1: Create ECR repos**

```bash
aws ecr create-repository --repository-name festival-backend --region us-east-1
aws ecr create-repository --repository-name festival-bot --region us-east-1
```

- [ ] **Step 2: Note the registry URL**

```bash
aws ecr describe-repositories \
  --query 'repositories[].repositoryUri' --output table
```

Add the account ID to GitHub secrets as `AWS_ACCOUNT_ID`.

- [ ] **Step 3: Create IAM role for GitHub Actions OIDC**

```bash
# Trust policy for GitHub OIDC
cat > /tmp/github-trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:YichiZ/festival-coordinator:*" }
    }
  }]
}
EOF

aws iam create-role --role-name festival-coordinator-deploy \
  --assume-role-policy-document file:///tmp/github-trust.json

aws iam attach-role-policy \
  --role-name festival-coordinator-deploy \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess  # tighten post-MVP
```

Add role ARN to GitHub secrets as `AWS_DEPLOY_ROLE_ARN`.

- [ ] **Step 4: First deploy (manual)**

```bash
cd infra
terraform init
terraform plan   # review before applying
terraform apply
```

- [ ] **Step 5: Verify all services**

```bash
terraform output
# backend_url  = "https://xxx.us-east-1.awsapprunner.com"
# bot_url      = "https://yyy.us-east-1.awsapprunner.com"
# frontend_url = "https://zzz.cloudfront.net"

curl $(terraform output -raw backend_url)/groups
```

Expected: JSON array of groups from production Supabase.

---

## Environment Summary


| Variable            | Where set                                                |
| ------------------- | -------------------------------------------------------- |
| `SUPABASE_URL`      | GitHub secret → Terraform → Secrets Manager → App Runner |
| `SUPABASE_API_KEY`  | GitHub secret → Terraform → Secrets Manager → App Runner |
| `ANTHROPIC_API_KEY` | GitHub secret → Terraform → Secrets Manager → App Runner |
| `CARTESIA_API_KEY`  | GitHub secret → Terraform → Secrets Manager → App Runner |
| `TWILIO_*`          | GitHub secret → Terraform → Secrets Manager → App Runner |
| `CORS_ORIGINS`      | Terraform env_var (CloudFront URL) → App Runner          |


## Post-MVP Improvements

- Tighten IAM role to least-privilege (ECR push + App Runner + Secrets Manager only)
- Add S3 remote state backend for Terraform
- Add staging environment (`env = "staging"`)
- Set up custom domain with ACM + Route 53
- Enable App Runner auto-scaling configuration

