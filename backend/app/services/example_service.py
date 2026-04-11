"""Example service - business logic layer.

Services contain business logic and coordinate between API routes (controllers),
repositories (data access), and external services.

Keep services focused on business rules, not data access or API concerns.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from app.models.response.example_response import ExampleResponse
from app.db.repositories.example_repository import ExampleRepository

logger = logging.getLogger(__name__)


class ExampleService:
    """
    Service for managing examples.
    
    This service demonstrates the recommended patterns:
    - Business logic in service methods
    - Repository for data access
    - Logging with context
    - Error handling
    """

    def __init__(self):
        self.repository = ExampleRepository()

    async def list_examples(
        self,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[ExampleResponse], int]:
        """
        List examples with pagination.
        
        Args:
            offset: Number of items to skip
            limit: Maximum items to return
            
        Returns:
            Tuple of (items, total_count)
        """
        items = await self.repository.find_all(offset=offset, limit=limit)
        total = await self.repository.count()
        
        return items, total

    async def get_example(self, example_id: str) -> Optional[ExampleResponse]:
        """
        Get a single example by ID.
        
        Args:
            example_id: The example ID
            
        Returns:
            ExampleResponse if found, None otherwise
        """
        return await self.repository.find_by_id(example_id)

    async def create_example(
        self,
        name: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ExampleResponse:
        """
        Create a new example.
        
        Args:
            name: Example name
            description: Optional description
            metadata: Optional metadata
            
        Returns:
            Created example
        """
        example_id = f"ex_{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        example = ExampleResponse(
            id=example_id,
            name=name,
            description=description,
            metadata=metadata,
            created_at=now,
            updated_at=None,
        )
        
        await self.repository.create(example)
        
        logger.info(
            "Example created",
            extra={"example_id": example_id, "example_name": name},
        )
        
        return example

    async def update_example(
        self,
        example_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[ExampleResponse]:
        """
        Update an existing example.
        
        Args:
            example_id: The example ID
            name: Optional new name
            description: Optional new description
            metadata: Optional new metadata
            
        Returns:
            Updated example if found, None otherwise
        """
        existing = await self.repository.find_by_id(example_id)
        if existing is None:
            return None
        
        updated = ExampleResponse(
            id=existing.id,
            name=name if name is not None else existing.name,
            description=description if description is not None else existing.description,
            metadata=metadata if metadata is not None else existing.metadata,
            created_at=existing.created_at,
            updated_at=datetime.now(timezone.utc),
        )
        
        await self.repository.update(updated)
        
        logger.info(
            "Example updated",
            extra={"example_id": example_id},
        )
        
        return updated

    async def delete_example(self, example_id: str) -> bool:
        """
        Delete an example.
        
        Args:
            example_id: The example ID
            
        Returns:
            True if deleted, False if not found
        """
        existing = await self.repository.find_by_id(example_id)
        if existing is None:
            return False
        
        await self.repository.delete(example_id)
        
        logger.info(
            "Example deleted",
            extra={"example_id": example_id},
        )
        
        return True
