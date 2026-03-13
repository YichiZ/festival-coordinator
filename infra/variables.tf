variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Deployment environment name (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "backend_image_uri" {
  description = "Full ECR image URI for the FastAPI backend"
  type        = string
}

variable "bot_image_uri" {
  description = "Full ECR image URI for the voice bot"
  type        = string
}

# Secrets — pass via TF_VAR_* env vars or CI secrets, never commit values
variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "cartesia_api_key" {
  description = "Cartesia API key for STT/TTS"
  type        = string
  sensitive   = true
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_api_key" {
  description = "Supabase anon/service key"
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio account SID (optional — only needed for telephony)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_auth_token" {
  description = "Twilio auth token (optional — only needed for telephony)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_number" {
  description = "Twilio phone number in E.164 format (optional)"
  type        = string
  default     = ""
}
