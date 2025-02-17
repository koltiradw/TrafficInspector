FROM python:3.12

RUN pip install alembic environs psycopg2

WORKDIR /code
COPY --from=backend_dir src/backend/ /code/
