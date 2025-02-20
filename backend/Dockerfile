FROM python:3.12

WORKDIR /code

RUN pip install poetry
# install packages
COPY pyproject.toml README.md ./
ENV POETRY_VIRTUALENVS_CREATE=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_NO_INTERACTION=1

RUN poetry install
# Copy project files
COPY api api
COPY configs configs
COPY models models
COPY utils utils
COPY main.py main.py

# Run
CMD poetry run python main.py
