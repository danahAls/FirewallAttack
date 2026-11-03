# Use a lightweight Debian Linux image as the base
FROM debian:bookworm-slim

# Update the package list and install network troubleshooting tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iproute2 iputils-ping curl ca-certificates \
        nmap tcpdump iptables \
        python3 python3-scapy python3-sklearn && \
    rm -rf /var/lib/apt/lists/*

# Keep the container running so we can enter it and run commands
CMD ["sleep", "infinity"]