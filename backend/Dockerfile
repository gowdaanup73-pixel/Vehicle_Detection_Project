FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    TORCH_HOME=/home/appuser/.cache/torch

# Install system dependencies for healthcheck curl and opencv runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 10001 appuser && \
    useradd -u 10000 -g appuser -s /bin/bash -m appuser

WORKDIR /app

# Install PyTorch CPU-only wheels first for efficient caching
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Install application dependencies
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Copy backend application code into /app/backend
COPY . /app/backend

# Create runtime directories and ensure ownership
RUN mkdir -p /app/backend/data \
             /app/backend/media/uploads \
             /app/backend/media/outputs \
             /app/backend/checkpoints \
             /home/appuser/.cache/torch && \
    chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "backend.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
