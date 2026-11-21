resource "aws_sesv2_email_identity" "this" {
  count = var.create_identity && var.from_email != "" ? 1 : 0

  email_identity = var.from_email
  tags           = var.tags
}
