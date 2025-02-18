from typing import Optional

from pydantic import BaseModel

from utils.pagination import PaginationData
from unicodedata import category

# last_seen, src_ip, dst_ip, ndpi.proto, ndpi.category
class FlowInfoBase(BaseModel):
    src_ip: str
    dst_ip: str
    last_seen: int
    ndpi_proto: str | None
    ndpi_category: str | None

class FlowInfoResponsePaginated(BaseModel):
    pagination: PaginationData
    results: list[FlowInfoBase]
