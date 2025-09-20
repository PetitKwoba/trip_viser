# Minimal production Dockerfile
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && pip install --no-cache-dir gunicorn
COPY . .
RUN python -m compileall .
RUN python manage.py collectstatic --noinput || true
ENV PORT=8000
CMD ["bash", "-lc", "gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT}"]
