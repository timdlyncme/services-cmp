from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime

class EnvironmentResourceBase(BaseModel):
    id: str
    name: str
    type: str
    provider: str
    status: str
    location: Optional[str] = None
    subscription_id: Optional[str] = None
    resource_group: Optional[str] = None
    created_at: Optional[datetime] = None
    
    # Environment and cloud account info
    environment_id: str
    environment_name: str
    cloud_account_id: str
    cloud_account_name: str

class EnvironmentResourceCreate(EnvironmentResourceBase):
    pass

class EnvironmentResourceUpdate(EnvironmentResourceBase):
    pass

class EnvironmentResourceInDBBase(EnvironmentResourceBase):
    class Config:
        orm_mode = True

class EnvironmentResource(EnvironmentResourceInDBBase):
    pass

class EnvironmentResourceInDB(EnvironmentResourceInDBBase):
    pass

