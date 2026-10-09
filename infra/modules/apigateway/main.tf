# api gateway type
resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"
}

# integration
resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.this.id

  integration_type = "AWS_PROXY"
  integration_uri  = var.lambda_invoke_arn

  payload_format_version = "2.0"
}

# JWT authorizer (Cognito User Pool). Gateway pre-filters invalid/expired
# tokens before they reach Lambda. App must still read claims for DB/roles.
resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id = aws_apigatewayv2_api.this.id

  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.api_name}-jwt"

  jwt_configuration {
    issuer   = var.jwt_issuer
    audience = var.jwt_audience
  }
}

# route
resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Public routes (no auth): login/signup/confirm/refresh + health checks.
# Everything else falls through to $default and requires JWT.
resource "aws_apigatewayv2_route" "public" {
  for_each = toset([
    "POST /auth/login",
    "POST /auth/create-user",
    "POST /auth/confirm",
    "POST /auth/resend-code",
    "POST /auth/refresh-token",
    "POST /auth/request-forgot-password",
    "POST /auth/confirm-forgot-password",
    "GET /health",
    "GET /hello",
  ])

  api_id    = aws_apigatewayv2_api.this.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

#stage
resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.this.id

  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id = "AllowApiGatewayInvoke"

  action = "lambda:InvokeFunction"

  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
