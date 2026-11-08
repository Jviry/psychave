"""AWS Cognito service re-export for backward compatibility."""
from services.auth.cognito_service import CognitoService

__all__ = ["CognitoService"]
