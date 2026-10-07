

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        iptables iproute2 conntrack procps iputils-ping && \
    rm -rf /var/lib/apt/lists/*

COPY firewall.sh /usr/local/bin/firewall.sh
RUN chmod +x /usr/local/bin/firewall.sh

ENTRYPOINT ["/usr/local/bin/firewall.sh"]