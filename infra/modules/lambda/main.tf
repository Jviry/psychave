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
      BREVO_API_KEY           = var.brevo_api_key
      FRONTEND_BASE_URL       = var.frontend_base_url
      FRONTEND_URL            = var.frontend_base_url
      PAYMONGO_SECRET_KEY     = var.paymongo_secret_key
      PAYMONGO_PUBLIC_KEY     = var.paymongo_public_key
      PAYMONGO_WEBHOOK_SECRET = var.paymongo_webhook_secret
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

# Scheduled background jobs (payment expiry, 24-48h pending SLA, session reminders)
resource "aws_lambda_function" "scheduler" {
  function_name = "${var.function_name}-scheduler"
  role          = aws_iam_role.lambda.arn

  runtime = var.runtime
  handler = "jobs.scheduled_tasks.handler"

  timeout     = 60
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
      BREVO_API_KEY           = var.brevo_api_key
      FRONTEND_BASE_URL       = var.frontend_base_url
      FRONTEND_URL            = var.frontend_base_url
      PAYMONGO_SECRET_KEY     = var.paymongo_secret_key
      PAYMONGO_PUBLIC_KEY     = var.paymongo_public_key
      PAYMONGO_WEBHOOK_SECRET = var.paymongo_webhook_secret
    }
  }
}

resource "aws_cloudwatch_event_rule" "scheduler_every_15m" {
  name                = "${var.function_name}-scheduler-15m"
  description         = "Run PsychAve payment expiry, SLA alerts, and session reminders every 15 minutes"
  schedule_expression = "rate(15 minutes)"
}

resource "aws_cloudwatch_event_target" "scheduler_target" {
  rule      = aws_cloudwatch_event_rule.scheduler_every_15m.name
  target_id = "psychave-scheduler"
  arn       = aws_lambda_function.scheduler.arn
}

resource "aws_lambda_permission" "eventbridge_scheduler" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduler_every_15m.arn
}
