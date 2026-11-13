FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 MLFLOW_DISABLE_AGENT_HINT=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY birdbrains ./birdbrains
RUN useradd --system app
USER app
# Cloud Run sets PORT. --factory builds the app at start-up, when credentials exist.
CMD ["sh", "-c", "exec uvicorn birdbrains.api:create_app --factory --host 0.0.0.0 --port ${PORT:-8080}"]
