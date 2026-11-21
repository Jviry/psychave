# lambda function
resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn

  runtime = var.runtime
  handler = "main.handler"

  timeout     = 25
  memory_size = 512

  filename         = var.lambda_zip_path
  source_code_hash = filebase64sha256(var.lambda_zip_path)

  depends_on = [
    aws_iam_role_policy_attachment.basic_execution
  ]

  environment {
    variables = {
      COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
      COGNITO_APP_CLIENT_ID = var.cognito_app_client_id
      DATABASE_URL          = var.database_url
      DB_SCHEMA             = var.db_schema
      CORS_ORIGINS          = jsonencode(var.cors_origins)
      EMAIL_FROM_NAME       = var.email_from_name
      EMAIL_FROM_EMAIL      = var.email_from_email
      EMAIL_REPLY_TO        = var.email_reply_to
      BREVO_API_KEY         = var.brevo_api_key
      FRONTEND_BASE_URL     = var.frontend_base_url
    }
  }
}

# IAM role for lambda
resource "aws_iam_role" "lambda" {
  name = "${var.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "lambda.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

# IAM policy for the role
resource "aws_iam_role_policy_attachment" "basic_execution" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Signup/confirm call Cognito Admin APIs (add to group, read sub/groups),
# so the Lambda role needs scoped access to this pool.
resource "aws_iam_role_policy" "cognito_admin" {
  name = "${var.function_name}-cognito"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:ListUsers",
        ]

        Resource = var.user_pool_arn
      }
    ]
  })
}

# Allow Lambda to send transactional booking/payment emails via Amazon SES
resource "aws_iam_role_policy" "ses_send" {
  name = "${var.function_name}-ses"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
        ]

        Resource = "*"
      }
    ]
  })
}
