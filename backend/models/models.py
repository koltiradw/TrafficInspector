"""Models for serivce"""
from sqlalchemy import (
    Integer,
    String,
    Text,
    Column,
    BigInteger,
    JSON
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):

    len_of_any_str_field = 100

    def __repr__(self):
        """Для более удобного отображения в дебаге"""
        cols = []
        for col in self.__table__.columns.keys():
            cols.append(f'{col}={value[:self.len_of_any_str_field] if isinstance(value := getattr(self, col), str) else value}')
        return f'<{self.__class__.__name__} {", ".join(cols)}›'


class FlowInfo(Base):
    __tablename__ = 'FLOW_INFO'

    id = Column(Integer, primary_key=True)
    src_ip = Column(Text, nullable=False)
    dst_ip = Column(Text, nullable=False)
    src_port = Column(Integer, nullable=False)
    dst_port = Column(Integer, nullable=False)
    ipv = Column(Integer, nullable=False)
    tcp_fingerprint = Column(String(255), nullable=False)
    proto = Column(String(50), nullable=False)
    src_country = Column(String(100))
    dst_country = Column(String(100))
    src_as = Column(Integer)
    dst_as = Column(Integer)
    first_seen = Column(BigInteger, nullable=False)
    last_seen = Column(BigInteger, nullable=False)
    num_pkts = Column(BigInteger, nullable=False)
    len_pkts = Column(BigInteger, nullable=False)
    ndpi = Column(JSON)
