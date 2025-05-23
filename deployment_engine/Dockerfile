FROM python:3.11-slim

WORKDIR /app

# Install Azure CLI for Bicep support
RUN apt-get update && \
    apt-get install -y curl gnupg lsb-release && \
    curl -sL https://aka.ms/InstallAzureCLIDeb | bash && \
    # Install Bicep
    az bicep install && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]

