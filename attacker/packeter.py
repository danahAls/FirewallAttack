# Here we build and sends packets and report what came backt to learner

from scapy.all import IP, TCP, UDP, ICMP, sr1, send, conf
import socket

import contract

conf.verb = 0   # stop Scapy printing its own send/receive and uses ours in the contract

ATTACKER_IP = "192.168.10.3"  

# Here it reads the template from the learner and build the packet based on it. Nothing is sent yet.
def build_packet(t):
    """Turn a template dict into a Scapy packet"""
    # Source: "self" = attacker IP; anything else = a forged address.
    src = ATTACKER_IP if t["src"] == "self" else t["src"]
    ip = IP(src=src, dst=contract.SERVER)

    if t["proto"] == "tcp":
        return ip / TCP(dport=t["dport"], flags=t["flags"])
    if t["proto"] == "udp":
        return ip / UDP(dport=t["dport"])
    if t["proto"] == "icmp":
        return ip / ICMP()        # echo request by default
    raise ValueError(f"unknown proto: {t['proto']}")



# Here we format the reply
def classify_reply(packet):
    """What came back? Returns one of contract's reply names."""
    if packet is None:
        return contract.REPLY_NONE          # silence: dropped, or reply lost
    if packet.haslayer(TCP):
        flags = packet[TCP].flags
        if flags & 0x12 == 0x12:            # SYN+ACK bits both set
            return contract.REPLY_SYNACK     # open port reached
        if flags & 0x04:                     # RST bit set
            return contract.REPLY_RST        # closed port but we got through
    if packet.haslayer(ICMP) and packet[ICMP].type == 0:
        return contract.REPLY_ICMP_REPLY     # echo reply ping succeeded
    return contract.REPLY_NONE



# The learner calls this function that send packets and returns reply facts
def probe(t, probe_id=0):
    if not contract.is_valid_template(t):
        return {"probe_id": probe_id, "reply": contract.REPLY_NONE, "error": "bad template"}

    pkt = build_packet(t)
    pkt[IP].id = probe_id          # mark the packet so it can be identified later

    count = t.get("count", 1)
    interval = t.get("interval", 0.0)

    reply = contract.REPLY_NONE
    if count == 1:
        ans = sr1(pkt, timeout=2)   # send one, wait for one reply
        reply = classify_reply(ans)
    else:
        # A burst (for rate-limit tests): send many, keep the best reply seen.
        import time
        for i in range(count):
            ans = sr1(pkt, timeout=1)
            r = classify_reply(ans)
            if r != contract.REPLY_NONE:
                reply = r            # any reply in the burst means some got through
            if interval:
                time.sleep(interval)

    return {"probe_id": probe_id, "reply": reply}



# If a port is reached pull the data in it 
def grab(t, path="/"):
    if t["proto"] != "tcp" or t["src"] != "self":
        return None
    try:
        s = socket.create_connection((contract.SERVER, t["dport"]), timeout=3)
        s.sendall(f"GET {path} HTTP/1.0\r\nHost: target\r\n\r\n".encode())
        data = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
        s.close()
        return data.decode(errors="replace")
    except OSError:
        return None

if __name__ == "__main__":
    door = {"proto":"tcp","flags":"S","dport":8081,"src":"self","count":1}
    print("probe 8081 :", probe(door))
    print("--- read the home page (blind) ---")
    home = grab(door, "/")
    print(home)
   
    if home and "/salaries" in home:
        print("--- page revealed /salaries, following it ---")
        print(grab(door, "/salaries"))
