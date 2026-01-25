from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PlanBase(BaseModel):
    name: str
    price: str
    limits: Dict[str, Any]

class PlanCreate(PlanBase):
    pass

class PlanResponse(PlanBase):
    id: int
    class Config:
        from_attributes = True

# Datasource Schemas
class DatasourceBase(BaseModel):
    name: str
    url: str
    config: Dict[str, Any] = {}

class DatasourceCreate(DatasourceBase):
    pass

class DatasourceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class DatasourceResponse(DatasourceBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Dashboard Schemas
class DashboardBase(BaseModel):
    name: str
    datasource_id: int
    widgets: List[Dict[str, Any]] = []
    filters: List[Dict[str, Any]] = []
    column_mapping: Dict[str, Any] = {}
    grid_columns: int = 12
    grid_rows: int = 10

class DashboardCreate(DashboardBase):
    pass

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    datasource_id: Optional[int] = None
    widgets: Optional[List[Dict[str, Any]]] = None
    filters: Optional[List[Dict[str, Any]]] = None
    column_mapping: Optional[Dict[str, Any]] = None
    grid_columns: Optional[int] = None
    grid_rows: Optional[int] = None

class DashboardResponse(DashboardBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Report Schemas
class ReportBase(BaseModel):
    name: str
    datasource_id: int
    widget_config: Dict[str, Any] = {}
    filters: List[Dict[str, Any]] = []
    column_mapping: Dict[str, Any] = {}

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseModel):
    name: Optional[str] = None
    datasource_id: Optional[int] = None
    widget_config: Optional[Dict[str, Any]] = None
    filters: Optional[List[Dict[str, Any]]] = None
    column_mapping: Optional[Dict[str, Any]] = None

class ReportResponse(ReportBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
