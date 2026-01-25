from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subscription = relationship("Subscription", back_populates="user", uselist=False)
    datasources = relationship("Datasource", back_populates="user")
    dashboards = relationship("Dashboard", back_populates="user")
    reports = relationship("Report", back_populates="user")

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # Free, Pro, Enterprise
    price = Column(String) # Stored as string for display e.g. "$9.50"
    limits = Column(JSON, default={}) # e.g. {"max_rows": 1000}

    subscriptions = relationship("Subscription", back_populates="plan")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_id = Column(Integer, ForeignKey("plans.id"))
    start_date = Column(DateTime(timezone=True), server_default=func.now())
    end_date = Column(DateTime(timezone=True), nullable=True) # Null means indefinite/auto-renew
    status = Column(String, default="active") # active, cancelled, expired

    user = relationship("User", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")

class Datasource(Base):
    __tablename__ = "datasources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    url = Column(String) # Google Sheet URL
    config = Column(JSON, default={}) # headers, specific sheet ID, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="datasources")
    dashboards = relationship("Dashboard", back_populates="datasource")
    reports = relationship("Report", back_populates="datasource")

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    datasource_id = Column(Integer, ForeignKey("datasources.id"))
    name = Column(String, nullable=False)
    widgets = Column(JSON, default=[]) # Array of widget configs
    filters = Column(JSON, default=[]) # Array of filter configs
    column_mapping = Column(JSON, default={}) # Original -> New column mapping
    grid_columns = Column(Integer, default=12) # Number of grid columns
    grid_rows = Column(Integer, default=10) # Number of grid rows
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="dashboards")
    datasource = relationship("Datasource", back_populates="dashboards")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    datasource_id = Column(Integer, ForeignKey("datasources.id"))
    name = Column(String, nullable=False)
    widget_config = Column(JSON, default={}) # Single widget config
    filters = Column(JSON, default=[]) # Array of filter configs
    column_mapping = Column(JSON, default={}) # Original -> New column mapping
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="reports")
    datasource = relationship("Datasource", back_populates="reports")
