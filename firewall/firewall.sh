#!/bin/bash

SERVER=192.168.20.10            # Protected web server
TRUSTED_NET=192.168.20.0/24     # Trusted internal network
EXTERNAL_NET=192.168.10.0/24    # External Docker network
DASHBOARD=192.168.10.4          # Authorized monitoring dashboard
NFLOG_GROUP=10                  # NFLOG receiver group

echo "[firewall] enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || \
    echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true

echo "[firewall] flushing previous rules..."
iptables -F
iptables -X 2>/dev/null || true
iptables -t nat -F

echo "[firewall] setting default policies..."
iptables -P INPUT DROP
iptables -P OUTPUT ACCEPT
iptables -P FORWARD DROP

iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -s "$DASHBOARD" -j ACCEPT # Allow dashboard monitoring

iptables -N LOG_ACCEPT # Logging chain for accepted traffic
iptables -A LOG_ACCEPT -m limit --limit 20/second --limit-burst 40 \
    -j NFLOG --nflog-group "$NFLOG_GROUP" --nflog-prefix "FW_ACCEPT"
iptables -A LOG_ACCEPT -j RETURN

iptables -N LOG_DROP # Logging chain for dropped traffic
iptables -A LOG_DROP -m limit --limit 20/second --limit-burst 40 \
    -j NFLOG --nflog-group "$NFLOG_GROUP" --nflog-prefix "FW_DROP"
iptables -A LOG_DROP -j RETURN

iptables -N LOG_REJECT # Logging chain for rejected traffic
iptables -A LOG_REJECT -m limit --limit 20/second --limit-burst 40 \
    -j NFLOG --nflog-group "$NFLOG_GROUP" --nflog-prefix "FW_REJECT"
iptables -A LOG_REJECT -j RETURN

iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED \
    -j ACCEPT # Allow established connections

iptables -A FORWARD -s "$TRUSTED_NET" \
    -j LOG_ACCEPT # Log trusted internal traffic
iptables -A FORWARD -s "$TRUSTED_NET" \
    -j ACCEPT # Allow trusted internal traffic

iptables -A FORWARD -p tcp --tcp-flags ALL NONE \
    -j LOG_DROP # Log NULL scans
iptables -A FORWARD -p tcp --tcp-flags ALL NONE \
    -j DROP # Block NULL scans

iptables -A FORWARD -p tcp --tcp-flags ALL FIN,PSH,URG \
    -j LOG_DROP # Log XMAS scans
iptables -A FORWARD -p tcp --tcp-flags ALL FIN,PSH,URG \
    -j DROP # Block XMAS scans

iptables -A FORWARD -p tcp ! --syn -m conntrack --ctstate NEW \
    -j LOG_DROP # Log abnormal TCP packets
iptables -A FORWARD -p tcp ! --syn -m conntrack --ctstate NEW \
    -j DROP # Block abnormal TCP packets

iptables -A FORWARD -d "$SERVER" -p icmp --icmp-type echo-request \
    -m limit --limit 1/second --limit-burst 3 \
    -j ACCEPT # Allow rate-limited ICMP

iptables -A FORWARD -d "$SERVER" -p icmp --icmp-type echo-request \
    -j LOG_DROP # Log excessive ICMP requests
iptables -A FORWARD -d "$SERVER" -p icmp --icmp-type echo-request \
    -j DROP # Block excessive ICMP requests

iptables -t nat -A PREROUTING -p tcp --dport 8081 \
    -j DNAT --to-destination "$SERVER":9000 # Preserve HR portal DNAT

iptables -A FORWARD -d "$SERVER" -p tcp --dport 22 \
    -j LOG_REJECT # Log rejected SSH connections
iptables -A FORWARD -d "$SERVER" -p tcp --dport 22 \
    -j REJECT --reject-with tcp-reset # Reject SSH connections with TCP RST

iptables -A FORWARD -d "$SERVER" -p tcp --dport 9000 \
    -j LOG_ACCEPT # Log permitted HR portal traffic
iptables -A FORWARD -d "$SERVER" -p tcp --dport 9000 \
    -j ACCEPT # Allow HR portal traffic

iptables -A FORWARD -d "$SERVER" -p tcp --dport 80 \
    -j LOG_ACCEPT # Log permitted HTTP traffic
iptables -A FORWARD -d "$SERVER" -p tcp --dport 80 \
    -j ACCEPT # Allow protected web server traffic

iptables -A FORWARD -j LOG_DROP # Log unmatched traffic before default DROP

iptables -t nat -A POSTROUTING -s "$EXTERNAL_NET" -d "$SERVER" \
    -j MASQUERADE # Preserve Docker network reply routing

echo "[firewall] rules installed. Current FORWARD chain:"
iptables -S FORWARD

echo "[firewall] starting NFLOG monitoring API..."
exec python3 /usr/local/bin/monitor.py