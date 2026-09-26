variable "environment" {
  type = string
}
variable "project_name" {
  type        = string
  default     = "psychave"
}

variable "callback_urls" {
  type        = list(string)
}

variable "logout_urls" {
  type        = list(string)
}

variable "self_sign_up_enabled" {
  description = "Whether clients can self-register"
  type        = bool
  default     = true
}
