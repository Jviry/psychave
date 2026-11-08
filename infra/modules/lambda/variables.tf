variable "function_name" {
  type = string
}

variable "lambda_zip_path" {
  type = string
}

variable "runtime" {
  type    = string
  default = "python3.14"
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_app_client_id" {
  type = string
}

variable "user_pool_arn" {
  description = "ARN of the Cognito User Pool (scopes the Admin API policy)"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL conn string passed as DATABASE_URL"
  type        = string
  sensitive   = true
}

variable "db_schema" {
  description = "Optional PostgreSQL schema for transaction-scoped search_path isolation"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "Allowed CORS origins passed to FastAPI as a JSON list"
  type        = list(string)
  default     = []
}
