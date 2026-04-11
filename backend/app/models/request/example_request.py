"""Example request models.

Define Pydantic models for incoming API requests here.
These models validate and parse incoming JSON data.
"""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class CreateExampleRequest(BaseModel):
    """Request model for creating an example."""
    
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the example",
        examples=["My Example"],
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional description",
        examples=["This is a sample example"],
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional metadata",
        examples=[{"key": "value"}],
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "name": "Sample Example",
                    "description": "A sample example for demonstration",
                    "metadata": {"category": "demo"},
                }
            ]
        }
    }


class UpdateExampleRequest(BaseModel):
    """Request model for updating an example."""
    
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
        description="Name of the example",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional description",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional metadata",
    )

