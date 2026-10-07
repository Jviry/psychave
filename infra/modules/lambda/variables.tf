variable "function_name" {
  type = string
}

variable "lambda_zip_path" {
  type = string
}

variable "runtime" {
  type = string
  default = "python3.14"
}

variable "cognito_user_pool_id" {
  type = string
}

variable "cognito_app_client_id" {
  type = string
}
