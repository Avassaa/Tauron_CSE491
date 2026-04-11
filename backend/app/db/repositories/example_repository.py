"""Example repository - data access layer.

Repositories handle all database operations, isolating data access logic from business logic.

This example uses in-memory storage for simplicity. Replace with actual database calls.
"""

import logging
from typing import Dict, List, Optional

from app.models.response.example_response import ExampleResponse
from app.db.models.example_model import ExampleModel

logger = logging.getLogger(__name__)

_storage: Dict[str, ExampleModel] = {}


class ExampleRepository:
    """
    Repository for example data access.
    
    This class demonstrates the repository pattern:
    - Encapsulates all database operations
    - Provides a clean interface for the service layer
    - Can be easily swapped for different database implementations
    """

    async def find_all(
        self,
        offset: int = 0,
        limit: int = 20,
    ) -> List[ExampleResponse]:
        """Find all examples with pagination."""
        items = [
            self._to_response(model)
            for model in _storage.values()
            if not model.is_deleted
        ]
        
        items.sort(key=lambda x: x.created_at, reverse=True)
        
        return items[offset:offset + limit]

    async def count(self) -> int:
        """Count total non-deleted examples."""
        return sum(1 for m in _storage.values() if not m.is_deleted)

    async def find_by_id(self, example_id: str) -> Optional[ExampleResponse]:
        """Find example by ID."""
        model = _storage.get(example_id)
        if model is None or model.is_deleted:
            return None
        return self._to_response(model)

    async def create(self, example: ExampleResponse) -> None:
        """Create a new example."""
        model = ExampleModel(
            id=example.id,
            name=example.name,
            description=example.description,
            metadata=example.metadata,
            created_at=example.created_at,
            updated_at=example.updated_at,
            is_deleted=False,
        )
        _storage[example.id] = model

    async def update(self, example: ExampleResponse) -> None:
        """Update an existing example."""
        model = _storage.get(example.id)
        if model is not None:
            model.name = example.name
            model.description = example.description
            model.metadata = example.metadata
            model.updated_at = example.updated_at

    async def delete(self, example_id: str) -> None:
        """Soft delete an example."""
        model = _storage.get(example_id)
        if model is not None:
            model.is_deleted = True

    async def hard_delete(self, example_id: str) -> None:
        """Permanently delete an example."""
        _storage.pop(example_id, None)

    def _to_response(self, model: ExampleModel) -> ExampleResponse:
        """Convert database model to response model."""
        return ExampleResponse(
            id=model.id,
            name=model.name,
            description=model.description,
            metadata=model.metadata,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
