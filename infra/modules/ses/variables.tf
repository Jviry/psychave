variable "from_email" {
  description = "Sender email address or domain identity for Amazon SES"
  type        = string
  default     = ""
}

variable "create_identity" {
  description = "Whether to provision the SES identity resource (false for ephemeral PR environments)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to the SES identity"
  type        = map(string)
  default     = {}
}
