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

module "frontend" {
  source = "./modules/frontend"
  name   = "festival-coordinator-${var.env}"
}

module "backend" {
  source    = "./modules/apprunner"
  name      = "festival-coordinator-backend-${var.env}"
  image_uri = var.backend_image_uri
  port      = 8000
  env_vars = {
    CORS_ORIGINS = module.frontend.cloudfront_url
  }
  secret_arns = module.secrets.secret_arns
}

module "bot" {
  source      = "./modules/apprunner"
  name        = "festival-coordinator-bot-${var.env}"
  image_uri   = var.bot_image_uri
  port        = 8080
  cpu         = "1024" # 1 vCPU — PyTorch + Silero VAD + smart turn need real CPU
  memory      = "2048" # 2 GB — PyTorch model loading requires ~1.5 GB+
  min_size    = 0
  secret_arns = module.secrets.secret_arns
}
