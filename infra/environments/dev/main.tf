module "lambda" {
  source = "../../modules/lambda"

  function_name = "${var.project_name}-${var.environment}-lambda"
  source_dir = var.lambda_path
}

module "apigateway" {
  source = "../../modules/apigateway"

  api_name = "${var.project_name}-${var.environment}-api"

  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
}
