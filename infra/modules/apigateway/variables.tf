variable "api_name" {
  type = string
}

variable "lambda_function_name" {
  type = string
}

variable "lambda_invoke_arn" {
  type = string
}

variable "jwt_issuer" {
  description = "JWT issuer, e.g. https://cognito-idp.<region>.amazonaws.com/<pool_id>"
  type        = string
}

variable "jwt_audience" {
  description = "JWT audience (Cognito app client IDs)"
  type        = list(string)
}
