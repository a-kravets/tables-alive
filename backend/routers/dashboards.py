from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Annotated, List

import models
import schemas
import database
from routers.auth import get_current_user

router = APIRouter(
    prefix="/dashboards",
    tags=["dashboards"]
)

@router.get("", response_model=List[schemas.DashboardResponse])
async def list_dashboards(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """List all dashboards for the current user"""
    result = await db.execute(
        select(models.Dashboard).where(models.Dashboard.user_id == current_user.id)
    )
    dashboards = result.scalars().all()
    return dashboards

@router.post("", response_model=schemas.DashboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    dashboard: schemas.DashboardCreate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Create a new dashboard"""
    # Verify datasource belongs to user
    result = await db.execute(
        select(models.Datasource).where(
            models.Datasource.id == dashboard.datasource_id,
            models.Datasource.user_id == current_user.id
        )
    )
    datasource = result.scalars().first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    new_dashboard = models.Dashboard(
        user_id=current_user.id,
        datasource_id=dashboard.datasource_id,
        name=dashboard.name,
        widgets=dashboard.widgets,
        filters=dashboard.filters,
        column_mapping=dashboard.column_mapping
    )
    db.add(new_dashboard)
    await db.commit()
    await db.refresh(new_dashboard)
    return new_dashboard

@router.get("/{dashboard_id}", response_model=schemas.DashboardResponse)
async def get_dashboard(
    dashboard_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Get a specific dashboard"""
    result = await db.execute(
        select(models.Dashboard).where(
            models.Dashboard.id == dashboard_id,
            models.Dashboard.user_id == current_user.id
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard

@router.put("/{dashboard_id}", response_model=schemas.DashboardResponse)
async def update_dashboard(
    dashboard_id: int,
    dashboard_update: schemas.DashboardUpdate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Update a dashboard"""
    result = await db.execute(
        select(models.Dashboard).where(
            models.Dashboard.id == dashboard_id,
            models.Dashboard.user_id == current_user.id
        )
    )
    dashboard = result.scalars().first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # If datasource_id is being updated, verify it belongs to user
    if dashboard_update.datasource_id is not None:
        result = await db.execute(
            select(models.Datasource).where(
                models.Datasource.id == dashboard_update.datasource_id,
                models.Datasource.user_id == current_user.id
            )
        )
        datasource = result.scalars().first()
        if not datasource:
            raise HTTPException(status_code=404, detail="Data source not found")
    
    update_data = dashboard_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)
    
    await db.commit()
    await db.refresh(dashboard)
    return dashboard

@router.delete("/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dashboard(
    dashboard_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Delete a dashboard"""
    try:
        result = await db.execute(
            select(models.Dashboard).where(
                models.Dashboard.id == dashboard_id,
                models.Dashboard.user_id == current_user.id
            )
        )
        dashboard = result.scalars().first()
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        await db.delete(dashboard)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete dashboard: {str(e)}")
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)
