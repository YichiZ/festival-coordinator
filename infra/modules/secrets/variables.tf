variable "env" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
}

variable "secrets" {
  description = "Map of secret name to secret value"
  type        = map(string)
  default     = {}
}
