"""
Base models module to avoid circular imports between models.
This file defines the SQLAlchemy Base and common imports.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.session import Base

def generate_uuid():
    """Generate a UUID string for use as an ID"""
    return str(uuid.uuid4())
