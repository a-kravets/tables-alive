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
    prefix="/datasources",
    tags=["datasources"]
)

@router.get("", response_model=List[schemas.DatasourceResponse])
async def list_datasources(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """List all data sources for the current user"""
    result = await db.execute(
        select(models.Datasource).where(models.Datasource.user_id == current_user.id)
    )
    datasources = result.scalars().all()
    return datasources

@router.post("", response_model=schemas.DatasourceResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource(
    datasource: schemas.DatasourceCreate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Create a new data source"""
    new_datasource = models.Datasource(
        user_id=current_user.id,
        name=datasource.name,
        url=datasource.url,
        config=datasource.config
    )
    db.add(new_datasource)
    await db.commit()
    await db.refresh(new_datasource)
    return new_datasource

@router.get("/{datasource_id}", response_model=schemas.DatasourceResponse)
async def get_datasource(
    datasource_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Get a specific data source"""
    result = await db.execute(
        select(models.Datasource).where(
            models.Datasource.id == datasource_id,
            models.Datasource.user_id == current_user.id
        )
    )
    datasource = result.scalars().first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Data source not found")
    return datasource

@router.put("/{datasource_id}", response_model=schemas.DatasourceResponse)
async def update_datasource(
    datasource_id: int,
    datasource_update: schemas.DatasourceUpdate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Update a data source"""
    result = await db.execute(
        select(models.Datasource).where(
            models.Datasource.id == datasource_id,
            models.Datasource.user_id == current_user.id
        )
    )
    datasource = result.scalars().first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    update_data = datasource_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(datasource, field, value)
    
    await db.commit()
    await db.refresh(datasource)
    return datasource

@router.delete("/{datasource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_datasource(
    datasource_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Delete a data source and all associated dashboards and reports"""
    try:
        result = await db.execute(
            select(models.Datasource).where(
                models.Datasource.id == datasource_id,
                models.Datasource.user_id == current_user.id
            )
        )
        datasource = result.scalars().first()
        if not datasource:
            raise HTTPException(status_code=404, detail="Data source not found")
        
        # Delete all dashboards that reference this datasource
        dashboards_result = await db.execute(
            select(models.Dashboard).where(
                models.Dashboard.datasource_id == datasource_id,
                models.Dashboard.user_id == current_user.id
            )
        )
        dashboards = dashboards_result.scalars().all()
        for dashboard in dashboards:
            await db.delete(dashboard)
        
        # Delete all reports that reference this datasource
        reports_result = await db.execute(
            select(models.Report).where(
                models.Report.datasource_id == datasource_id,
                models.Report.user_id == current_user.id
            )
        )
        reports = reports_result.scalars().all()
        for report in reports:
            await db.delete(report)
        
        # Delete the datasource itself
        await db.delete(datasource)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete data source: {str(e)}")
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)
