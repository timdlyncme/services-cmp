FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install netcat for health check
RUN apt-get update && apt-get install -y netcat-openbsd

COPY . .

ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Make the start script executable
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]

