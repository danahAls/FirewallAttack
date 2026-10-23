# Use a lightweight Debian Linux image as the base
FROM debian:bookworm-slim

# Update the package list and install network troubleshooting tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    iproute2 \
    iputils-ping \
    curl \
    nmap \
    tcpdump \
    python3 \
    python3-pip \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Keep the container running so we can enter it and run commands
CMD ["sleep", "infinity"]