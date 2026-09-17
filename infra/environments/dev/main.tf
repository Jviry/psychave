module "lambda" {
  source = "../../modules/lambda"

  function_name = "${var.project_name}-${var.environment}-api"
  source_dir    = "${path.root}/../../../lambda_src"
}

module "apigateway" {
  source = "../../modules/apigateway"

  api_name = "${var.project_name}-${var.environment}-api"

  lambda_function_name = module.lambda.function_name
  lambda_function_arn  = module.lambda.function_arn
  lambda_invoke_arn    = module.lambda.invoke_arn
}
