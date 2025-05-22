FROM python:3.11-slim

# Set the working directory  
WORKDIR /app

# Copy the requirements file  
COPY requirements.txt .  

# Install any dependencies  
RUN pip install --no-cache-dir -r requirements.txt  

# Copy the application code  
COPY . .  

# Set the entry point for the container  
ENTRYPOINT ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
