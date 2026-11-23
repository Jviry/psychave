variable "aws_region" {
  type = string
}

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "lambda_zip_path" {
  type = string
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "db_schema" {
  type    = string
  default = ""
}

variable "cors_origins" {
  type = list(string)
}

variable "email_from_name" {
  type    = string
  default = "PsychAvenuePH"
}

variable "email_from_email" {
  type    = string
  default = ""
}

variable "email_reply_to" {
  type    = string
  default = ""
}

variable "brevo_api_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "frontend_base_url" {
  type    = string
  default = "https://psychave-dev.vercel.app"
}

variable "paymongo_secret_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "paymongo_public_key" {
  type      = string
  default   = ""
  sensitive = true
}

variable "paymongo_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}
