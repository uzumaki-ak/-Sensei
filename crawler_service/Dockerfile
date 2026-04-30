FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY crawler_service/requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir -r /tmp/requirements.txt \
  && playwright install --with-deps chromium

COPY scripts /app/scripts
COPY crawler_service /app/crawler_service

ENV PORT=10000

EXPOSE 10000

CMD ["uvicorn", "crawler_service.app:app", "--host", "0.0.0.0", "--port", "10000"]
