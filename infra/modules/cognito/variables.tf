variable "user_pool_name" {
  description = "Name of the Cognito User Pool"
  type        = string
}

variable "app_client_name" {
  description = "Name of the Cognito App Client"
  type        = string
}

variable "tags" {
  description = "Tags to apply to the Cognito resources"
  type        = map(string)
  default     = {}
}
