variable "name" {
  description = "Name of the App Runner service"
  type        = string
}

variable "image_uri" {
  description = "Full ECR image URI including tag"
  type        = string
}

variable "port" {
  description = "Port the container listens on"
  type        = number
  default     = 8000
}

variable "cpu" {
  description = "vCPU units (256 = 0.25 vCPU, 1024 = 1 vCPU)"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "Memory in MB (512 = 0.5 GB, 2048 = 2 GB)"
  type        = string
  default     = "512"
}

variable "min_size" {
  description = "Minimum number of instances (App Runner requires >= 1)"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum number of instances"
  type        = number
  default     = 1
}

variable "env_vars" {
  description = "Plain-text environment variables"
  type        = map(string)
  default     = {}
}

variable "secret_arns" {
  description = "Map of env var name to Secrets Manager ARN"
  type        = map(string)
  default     = {}
}
