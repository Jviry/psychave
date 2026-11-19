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

variable "email_from_name" {
  description = "Display name for transactional emails"
  type        = string
  default     = "PsychAvenuePH"
}

variable "email_from_email" {
  description = "Verified sender email address (leave empty to skip sending)"
  type        = string
  default     = ""
}

variable "email_reply_to" {
  description = "Optional Reply-To email address for transactional emails"
  type        = string
  default     = ""
}

variable "brevo_api_key" {
  description = "Brevo transactional email API key (leave empty to skip sending)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "frontend_base_url" {
  description = "Base URL of the frontend used in email links"
  type        = string
  default     = "http://localhost:3000"
}
