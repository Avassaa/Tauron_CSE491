"""Declarative base for SQLAlchemy ORM models."""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM tables (optionally under ``DATABASE_SCHEMA``)."""

    metadata = MetaData(schema=settings.effective_database_schema)
