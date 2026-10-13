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
