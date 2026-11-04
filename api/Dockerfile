# Mesma versão principal do treino; wheels CPU para a implantação inicial.
FROM python:3.11-slim-bookworm
WORKDIR /app
ARG MODEL_SHA256
RUN test -n "$MODEL_SHA256"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 MODEL_PATH=/app/models/best.pt DEVICE=cpu CPU_THREADS=1 OMP_NUM_THREADS=1 YOLO_CONFIG_DIR=/tmp/Ultralytics
ENV EXPECTED_MODEL_SHA256=$MODEL_SHA256
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY models/best.pt ./models/best.pt
RUN python -c "import hashlib,os; from pathlib import Path; assert hashlib.sha256(Path('models/best.pt').read_bytes()).hexdigest() == os.environ['EXPECTED_MODEL_SHA256'], 'Checkpoint incorreto'"
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
