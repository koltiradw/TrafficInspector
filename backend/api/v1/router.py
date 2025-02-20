"""API V1"""
from fastapi import APIRouter

from api.v1.flow.router import router as flow_router


router = APIRouter()

router.include_router(flow_router, prefix='/flows')
