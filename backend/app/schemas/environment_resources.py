from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from datetime import datetime

class CloudResourceResponse(BaseModel):
    id: str
    name: str
    type: str
    region: str
    status: str
    provider: str
    created_at: str
    subscription_id: Optional[str] = None
    resource_group: Optional[str] = None
    tags: Optional[Dict[str, str]] = None

