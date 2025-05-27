from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query, Body, Path
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import requests
import os
import json
from datetime import datetime
from pydantic import BaseModel, Field

from app.db.session import get_db
