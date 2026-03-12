variable "name" {
  description = "Base name used for S3 bucket and CloudFront distribution"
  type        = string
}

variable "dist_path" {
  description = "Local path to the frontend build output directory"
  type        = string
  default     = "../frontend/dist"
}
