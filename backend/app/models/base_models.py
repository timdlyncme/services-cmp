"""
Base models module to avoid circular imports between models.
This file defines the SQLAlchemy Base and common imports.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Table
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base
