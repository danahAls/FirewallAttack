FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iptables \
        iproute2 \
        conntrack \
        procps \
        iputils-ping \
        python3 \
        python3-pip \
        libnetfilter-log1 \
        libnetfilter-log-dev \
        libnfnetlink0 \
        libnfnetlink-dev \
        gcc \
        python3-dev && \
    rm -rf /var/lib/apt/lists/*

COPY firewall.sh /usr/local/bin/firewall.sh
COPY monitor.py /usr/local/bin/monitor.py

RUN chmod +x /usr/local/bin/firewall.sh

ENTRYPOINT ["/usr/local/bin/firewall.sh"]