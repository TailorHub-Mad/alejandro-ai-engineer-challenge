FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY frontend/ frontend/
COPY tests/ tests/
COPY --chown=10001:10001 eval/ eval/
RUN mkdir -p data/raw data/store data/logs && chown -R 10001:10001 data
USER 10001:10001
EXPOSE 8000
CMD ["python", "-m", "backend", "--container"]
