#!/bin/bash

set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z ${POSTGRES_SERVER:-localhost} ${POSTGRES_PORT:-5432}; do
  sleep 0.1
done
echo "PostgreSQL is ready!"

# Initialize the database
echo "Initializing the database..."
python init_db.py

# Start the application
echo "Starting the application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

