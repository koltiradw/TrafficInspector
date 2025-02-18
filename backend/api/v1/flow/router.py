from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
import sqlalchemy as sa

from models.models import FlowInfo
from .schemas import FlowInfoResponsePaginated, FlowInfoBase
from utils.pagination import get_pagination_dep, PaginationData
from utils.database import get_session


router = APIRouter()

@router.get("/")
async def get_flows_infos(
    pagination_data: PaginationData = Depends(get_pagination_dep),
    session: Session = Depends(get_session)
) -> FlowInfoResponsePaginated:
    """
    Get a list of flow info entries with pagination.

    :param PaginationData pagination_data: Paged data.
    :param Session db: Database session.
    :return: A paginated response containing the flow info records.
    :rtype: PaginatedFlowInfoResponse
    """

    flow_infos = await session.execute(
        sa.select(
            FlowInfo.last_seen,
            FlowInfo.src_ip,
            FlowInfo.dst_ip,
            FlowInfo.ndpi,
        )
        .offset(pagination_data.get_db_offset())
        .limit(pagination_data.get_db_limit())
    )

    return FlowInfoResponsePaginated(
        pagination=pagination_data,
        results=[
            FlowInfoBase(
                src_ip=flow.src_ip,
                dst_ip=flow.dst_ip,
                last_seen=flow.last_seen,
                ndpi_proto=flow.ndpi.get('proto'),
                ndpi_category=flow.ndpi.get('category'),
            )
            for flow in flow_infos.all()
        ]
    )
