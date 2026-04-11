"""Example CRUD routes.

This module demonstrates the recommended patterns for building API routes.
Replace with your actual business logic.

Key patterns shown:
- Dependency injection for auth
- Pydantic models for request/response
- Service layer for business logic
- Repository pattern for data access
- Proper error handling
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.dependencies import (
    get_pagination,
    get_request_id,
    PaginationParams,
)
from app.core.security import get_current_user_id
from app.models.request.example_request import (
    CreateExampleRequest,
    UpdateExampleRequest,
)
from app.models.response.example_response import (
    ExampleResponse,
    ExampleListResponse,
)
from app.services.example_service import ExampleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/examples")


@router.get("", response_model=ExampleListResponse)
async def list_examples(
    pagination: PaginationParams = Depends(get_pagination),
    _user_id: uuid.UUID = Depends(get_current_user_id),
    request_id: str = Depends(get_request_id),
):
    """
    List all examples with pagination.

    Requires a valid JWT (Bearer).
    """
    logger.info(
        "Listing examples",
        extra={
            "page": pagination.page,
            "page_size": pagination.page_size,
            "request_id": request_id,
        },
    )

    service = ExampleService()
    items, total = await service.list_examples(
        offset=pagination.offset,
        limit=pagination.page_size,
    )

    return ExampleListResponse(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{example_id}", response_model=ExampleResponse)
async def get_example(
    example_id: str,
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Get a single example by ID.

    Requires a valid JWT (Bearer).
    """
    service = ExampleService()
    item = await service.get_example(example_id)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Example {example_id} not found",
        )

    return item


@router.post("", response_model=ExampleResponse, status_code=status.HTTP_201_CREATED)
async def create_example(
    request: CreateExampleRequest,
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Create a new example.

    Requires a valid JWT (Bearer).
    """
    logger.info(
        "Creating example",
        extra={"example_name": request.name},
    )

    service = ExampleService()
    item = await service.create_example(
        name=request.name,
        description=request.description,
        metadata=request.metadata,
    )

    return item


@router.put("/{example_id}", response_model=ExampleResponse)
async def update_example(
    example_id: str,
    request: UpdateExampleRequest,
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Update an existing example.

    Requires a valid JWT (Bearer).
    """
    service = ExampleService()
    item = await service.update_example(
        example_id=example_id,
        name=request.name,
        description=request.description,
        metadata=request.metadata,
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Example {example_id} not found",
        )

    return item


@router.delete("/{example_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_example(
    example_id: str,
    _user_id: uuid.UUID = Depends(get_current_user_id),
):
    """
    Delete an example.

    Requires a valid JWT (Bearer).
    """
    service = ExampleService()
    deleted = await service.delete_example(example_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Example {example_id} not found",
        )
