output "backend_url" {
  description = "HTTPS URL of the FastAPI backend App Runner service"
  value       = module.backend.service_url
}

output "bot_url" {
  description = "HTTPS URL of the voice bot App Runner service"
  value       = module.bot.service_url
}

output "frontend_url" {
  description = "HTTPS URL of the CloudFront-fronted React frontend"
  value       = module.frontend.cloudfront_url
}

output "s3_bucket_name" {
  description = "S3 bucket name for syncing the frontend build"
  value       = module.frontend.s3_bucket_name
}

output "distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = module.frontend.distribution_id
}
