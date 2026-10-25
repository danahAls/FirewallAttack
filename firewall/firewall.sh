#!/bin/bash 

### Here is the firewall that sits between the internal network (were the webserver is) and external network (where the attacker is) 



SERVER=192.168.20.10            # the web server we are protecting
TRUSTED_NET=192.168.20.0/24     # the internal network = trusted
 
echo "[firewall] enabling IP forwarding (fallback; also set in compose)..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || \
  echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true
 
echo "[firewall] flushing any old rules..."
iptables -F
iptables -X 2>/dev/null || true
iptables -t nat -F
 
echo "[firewall] setting default policies..."
iptables -P INPUT DROP
iptables -P OUTPUT ACCEPT

iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -P FORWARD DROP         # block everything crossing unless a rule below allows it
 

# 1) Let replies and ongoing connections flow back.
#    When the attacker opens an allowed connection, the server's answers come
#    back in the other direction; those packets are ESTABLISHED/RELATED.
iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
 
# 2) Trust traffic that originates inside the internal network.

iptables -A FORWARD -s "$TRUSTED_NET" -j ACCEPT
 

# 3) Drop stealth-scan packets (abnormal TCP flag combinations).

# NULL scan: a TCP packet with no flags set at all.
iptables -A FORWARD -p tcp --tcp-flags ALL NONE -j DROP
# XMAS scan: the real nmap xmas sets FIN + PSH + URG (not "all flags").
iptables -A FORWARD -p tcp --tcp-flags ALL FIN,PSH,URG -j DROP
# (abnormal combinations and FIN/ACK stealth scans).
iptables -A FORWARD -p tcp ! --syn -m conntrack --ctstate NEW -j DROP
 

# 4) ICMP (ping): allow a slow trickle to the server, drop the rest.
#    This blunts simple ping floods / ping sweeps.
iptables -A FORWARD -d "$SERVER" -p icmp --icmp-type echo-request \
         -m limit --limit 1/second --limit-burst 3 -j ACCEPT
iptables -A FORWARD -d "$SERVER" -p icmp --icmp-type echo-request -j DROP
 


iptables -A FORWARD -d "$SERVER" -p tcp --dport 22 -j ACCEPT
iptables -A FORWARD -d "$SERVER" -p tcp --dport 80 -j ACCEPT

# Keep the return path through the firewall on Docker Desktop and other
# bridged setups that do not reliably route replies between Docker bridges.
# Filtering still happens above; this only applies source NAT to permitted
# external traffic headed to the protected server.
iptables -t nat -A POSTROUTING -s 192.168.10.0/24 -d "$SERVER" -o eth1 -j MASQUERADE
 
# Everything else is dropped automatically by the FORWARD policy (DROP).

echo "[firewall] rules installed. Current FORWARD chain:" #Chacking if firewall rules are implemented and shows them
iptables -S FORWARD
 
echo "[firewall] up and forwarding. Leaving container running." #Firewall is on a continer on it's own
exec sleep infinity
 
