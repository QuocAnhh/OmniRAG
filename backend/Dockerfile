FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install CPU-only torch first to avoid massive CUDA downloads (saves ~800MB+)
RUN pip install --no-cache-dir --timeout=1000 --retries=5 torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
# Install remaining dependencies
RUN pip install --no-cache-dir --timeout=1000 --retries=5 -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
