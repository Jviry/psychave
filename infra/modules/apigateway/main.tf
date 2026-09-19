resource "aws_apigatewayv2_api" "this" {
  name          = var.api_name
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.this.id

  integration_type   = "AWS_PROXY"
  integration_uri    = var.lambda_invoke_arn
  integration_method = "POST"

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id = aws_apigatewayv2_api.this.id

  route_key = "GET /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.this.id

  name      = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id = "AllowApiGatewayInvoke"

  action = "lambda:InvokeFunction"

  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
