FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iproute2 \
        iputils-ping \
        curl \
        ca-certificates \
        nmap \
        tcpdump \
        iptables \
        python3 \
        python3-scapy \
        python3-sklearn \
        python3-matplotlib \
        python3-flask && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /lab

EXPOSE 5001

CMD ["sleep", "infinity"]