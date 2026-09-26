# lambda function
resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn

  runtime = var.runtime
  handler = "main.handler"

  filename         = "${path.root}/../../../backend/lambda.zip"
  source_code_hash = filebase64sha256("${path.root}/../../../backend/lambda.zip")

  depends_on = [
    aws_iam_role_policy_attachment.basic_execution
  ]
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
