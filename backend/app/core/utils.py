"""
Utility functions for the application.
"""
from typing import Any, Dict, List, Optional

def format_error_response(error: Exception) -> Dict[str, Any]:
    """
    Format an error response to avoid exposing sensitive information
    
    Args:
        error: The exception that was raised
        
    Returns:
        A dictionary with a user-friendly error message
    """
    error_type = type(error).__name__
    error_message = str(error)
    
    # Handle specific error types
    if "UniqueViolation" in error_type or "IntegrityError" in error_type:
        if "duplicate key" in error_message:
            return {"detail": "A record with this information already exists"}
        return {"detail": "Database constraint violation"}
    
    if "ForeignKeyViolation" in error_type:
        return {"detail": "Referenced record does not exist"}
    
    if "NotFound" in error_type or "DoesNotExist" in error_type:
        return {"detail": "The requested resource was not found"}
    
    if "Unauthorized" in error_type or "Forbidden" in error_type:
        return {"detail": "You do not have permission to perform this action"}
    
    # For other errors, return a generic message
    return {"detail": f"An error occurred: {error_message}"}
