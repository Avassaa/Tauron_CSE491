"""Example response models.

Define Pydantic models for API responses here.
These models serialize data for JSON responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ExampleResponse(BaseModel):
    """Response model for a single example."""
    
    id: str = Field(
        ...,
        description="Unique identifier",
        examples=["ex_123abc"],
    )
    name: str = Field(
        ...,
        description="Name of the example",
        examples=["My Example"],
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional metadata",
    )
    created_at: datetime = Field(
        ...,
        description="Creation timestamp",
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        description="Last update timestamp",
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "examples": [
                {
                    "id": "ex_123abc",
                    "name": "Sample Example",
                    "description": "A sample example",
                    "metadata": {"category": "demo"},
                    "created_at": "2026-01-05T10:30:00Z",
                    "updated_at": "2026-01-05T11:00:00Z",
                }
            ]
        }
    }


class ExampleListResponse(BaseModel):
    """Response model for a list of examples with pagination."""
    
    items: List[ExampleResponse] = Field(
        ...,
        description="List of examples",
    )
    total: int = Field(
        ...,
        description="Total number of items",
        ge=0,
    )
    page: int = Field(
        ...,
        description="Current page number",
        ge=1,
    )
    page_size: int = Field(
        ...,
        description="Number of items per page",
        ge=1,
    )
    
    @property
    def has_more(self) -> bool:
        """Check if there are more pages."""
        return self.page * self.page_size < self.total

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "items": [
                        {
                            "id": "ex_123abc",
                            "name": "Example 1",
                            "description": None,
                            "metadata": None,
                            "created_at": "2026-01-05T10:30:00Z",
                            "updated_at": None,
                        }
                    ],
                    "total": 1,
                    "page": 1,
                    "page_size": 20,
                }
            ]
        }
    }

