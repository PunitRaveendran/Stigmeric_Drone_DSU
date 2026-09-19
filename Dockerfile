# ─── Stage 1: Build the React / Vite Web Dashboard ──────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent || npm install --silent
COPY . .
RUN npm run build

# ─── Stage 2: Python ML & Swarm Telemetry Microservice ──────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install runtime system libraries for PyTorch, OpenCV, and Audio I/O
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install CPU-only PyTorch (drastically reduces image size from ~2.5GB to <400MB for Render free tier)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy production static bundle from frontend build stage
COPY --from=frontend-builder /app/dist ./dist

# Copy application source and ML models
COPY . .

ENV PORT=10000
ENV PYTHONUNBUFFERED=1
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV OMP_NUM_THREADS=1
ENV RENDER=true

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:10000/api/health || exit 1

CMD ["python", "src/api_server.py"]
