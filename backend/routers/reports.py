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
    prefix="/reports",
    tags=["reports"]
)

@router.get("", response_model=List[schemas.ReportResponse])
async def list_reports(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """List all reports for the current user"""
    result = await db.execute(
        select(models.Report).where(models.Report.user_id == current_user.id)
    )
    reports = result.scalars().all()
    return reports

@router.post("", response_model=schemas.ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report: schemas.ReportCreate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Create a new report"""
    # Verify datasource belongs to user
    result = await db.execute(
        select(models.Datasource).where(
            models.Datasource.id == report.datasource_id,
            models.Datasource.user_id == current_user.id
        )
    )
    datasource = result.scalars().first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    new_report = models.Report(
        user_id=current_user.id,
        datasource_id=report.datasource_id,
        name=report.name,
        widget_config=report.widget_config,
        filters=report.filters,
        column_mapping=report.column_mapping
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    return new_report

@router.get("/{report_id}", response_model=schemas.ReportResponse)
async def get_report(
    report_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Get a specific report"""
    result = await db.execute(
        select(models.Report).where(
            models.Report.id == report_id,
            models.Report.user_id == current_user.id
        )
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.put("/{report_id}", response_model=schemas.ReportResponse)
async def update_report(
    report_id: int,
    report_update: schemas.ReportUpdate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Update a report"""
    result = await db.execute(
        select(models.Report).where(
            models.Report.id == report_id,
            models.Report.user_id == current_user.id
        )
    )
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # If datasource_id is being updated, verify it belongs to user
    if report_update.datasource_id is not None:
        result = await db.execute(
            select(models.Datasource).where(
                models.Datasource.id == report_update.datasource_id,
                models.Datasource.user_id == current_user.id
            )
        )
        datasource = result.scalars().first()
        if not datasource:
            raise HTTPException(status_code=404, detail="Data source not found")
    
    update_data = report_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)
    
    await db.commit()
    await db.refresh(report)
    return report

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: AsyncSession = Depends(database.get_db)
):
    """Delete a report"""
    try:
        result = await db.execute(
            select(models.Report).where(
                models.Report.id == report_id,
                models.Report.user_id == current_user.id
            )
        )
        report = result.scalars().first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        await db.delete(report)
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)
