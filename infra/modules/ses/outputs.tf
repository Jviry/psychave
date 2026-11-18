output "email_identity_arn" {
  description = "ARN of the SES email identity (empty when unset or skipped)"
  value       = try(aws_sesv2_email_identity.this[0].arn, "")
}
