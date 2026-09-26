variable "function_name" {
  type = string
}

variable "lambda_zip_path" {
  type = string
}

variable "runtime" {
  type = string
  default = "python3.14"
}
