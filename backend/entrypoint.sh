#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
while ! nc -z ${POSTGRES_SERVER} ${POSTGRES_PORT}; do
  sleep 0.1
done
echo "PostgreSQL is up and running!"

# Initialize the database
python init_db.py

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

