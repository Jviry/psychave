module "lambda" {
  source = "../../modules/lambda"

  function_name = "${var.project_name}-${var.environment}-lambda"
  lambda_zip_path = var.lambda_zip_path

  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_app_client_id = module.cognito.client_id
}

module "apigateway" {
  source = "../../modules/apigateway"

  api_name = "${var.project_name}-${var.environment}-api"

  lambda_function_name = module.lambda.function_name
  lambda_invoke_arn    = module.lambda.invoke_arn
}

module "cognito" {
  source = "../../modules/cognito"

  user_pool_name = "${var.project_name}-${var.environment}-users"
  app_client_name = "${var.project_name}-${var.environment}-client"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

module "s3" {
  source = "../../modules/s3"

  bucket_name = "${var.project_name}-${var.environment}-uploads"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
