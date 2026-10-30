# Use Python 3.12 as the base image.
FROM python:3.12-slim

# Set the working directory inside the container.
WORKDIR /app

# Install iproute2 to configure the dashboard's network route.
RUN apt-get update && \
    apt-get install -y --no-install-recommends iproute2 && \
    rm -rf /var/lib/apt/lists/*

# Install Flask to run the dashboard.
RUN pip install --no-cache-dir Flask==3.0.3

# Copy the dashboard application.
COPY app.py .

# Copy the HTML templates.
COPY templates/ ./templates/

# Copy the CSS and JavaScript files.
COPY static/ ./static/

# Start the Flask dashboard.
CMD ["python", "app.py"]
