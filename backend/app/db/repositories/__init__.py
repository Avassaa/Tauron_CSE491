"""Repository pattern for data access.

Repositories encapsulate all database operations, keeping
the service layer clean and database-agnostic.
"""

from .example_repository import ExampleRepository

__all__ = ["ExampleRepository"]

