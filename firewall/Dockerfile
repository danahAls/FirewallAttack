FROM debian:bookworm-slim

# Install the original firewall tools and Python 3 for monitoring.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iptables iproute2 conntrack procps iputils-ping python3 && \
    rm -rf /var/lib/apt/lists/*

# Copy the firewall startup script.
COPY firewall.sh /usr/local/bin/firewall.sh

# Copy the read-only firewall monitoring API.
COPY monitor.py /usr/local/bin/monitor.py

# Make the firewall startup script executable.
RUN chmod +x /usr/local/bin/firewall.sh

# Keep the original firewall startup process.
ENTRYPOINT ["/usr/local/bin/firewall.sh"]