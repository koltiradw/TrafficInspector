from typing import Annotated

from fastapi import Query
from pydantic import BaseModel

from configs import config


class PaginationData(BaseModel):
    page: int
    size: int

    def get_db_limit(self):
        """Get limit for DB request"""
        return self.size

    def get_db_offset(self):
        """Get offset for DB request"""
        return self.size * (self.page - 1)

    def get_db_params(self) -> (int, int):
        """Get limit and offset for DB request"""
        return self.get_db_limit(), self.get_db_offset()


def get_pagination_dep(
        page: Annotated[
                int,
                Query(ge=1, description="Page number"),
            ] = 1,
        size: Annotated[
            int,
            Query(ge=1, le=100, description="Page size")
        ] = config.API_PAGINATION_SIZE) -> PaginationData:
    """Dependency for pagination"""
    return PaginationData(page=page, size=size)
