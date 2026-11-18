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

variable "ses_from_name" {
  type    = string
  default = "PsychAvenuePH"
}

variable "ses_from_email" {
  type    = string
  default = ""
}

variable "ses_reply_to" {
  type    = string
  default = ""
}

variable "frontend_base_url" {
  type    = string
  default = "https://psychave-dev.vercel.app"
}
