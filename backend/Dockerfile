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

# Create a startup script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Wait for PostgreSQL to be ready\n\
echo "Waiting for PostgreSQL to be ready..."\n\
while ! nc -z ${POSTGRES_SERVER:-localhost} ${POSTGRES_PORT:-5432}; do\n\
  sleep 0.1\n\
done\n\
echo "PostgreSQL is ready!"\n\
\n\
# Initialize the database\n\
echo "Initializing the database..."\n\
python init_db.py\n\
\n\
# Start the application\n\
echo "Starting the application..."\n\
exec uvicorn app.main:app --host 0.0.0.0 --port 8000\n\
' > /app/docker-entrypoint.sh \
&& chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]

