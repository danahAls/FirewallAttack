# every packet the learner may choose from.
import contract


PORTS = [80, 8081, 9000, 22, 443, 8080, 3306, 25, 53, 3389, 5000, 12345]

# TCP flag combinations: normal + stealth-scan shapes.
TCP_FLAGS = ["S", "A", "F", "R", "FA", "", "FPU"]   # "" = NULL, FPU = Xmas

# Sources: our real address, and forged internal ones for the spoof finding.
SOURCES = ["self", "192.168.20.50", "192.168.20.99"]


def build_action_space():
    """Return the full list of templates the learner can choose from."""
    templates = []

        # 1) TCP from attacker source
    for port in PORTS:
        for flags in TCP_FLAGS:
            templates.append({
                "proto": "tcp", "flags": flags, "dport": port,
                "src": "self", "count": 1, "interval": 0.0,
            })

    # 1b) TCP from FORGED sources
    for port in [80, 9000, 8081]:
        for src in ["192.168.20.50", "192.168.20.99"]:
            templates.append({
                "proto": "tcp", "flags": "S", "dport": port,
                "src": src, "count": 1, "interval": 0.0,
            })

    # 2) UDP
    for port in PORTS:
        templates.append({
            "proto": "udp", "flags": "", "dport": port,
            "src": "self", "count": 1, "interval": 0.0,
        })

    # 3) ICMP single ping 
    templates.append({
        "proto": "icmp", "flags": "", "dport": 0,
        "src": "self", "count": 1, "interval": 0.0,
    })

    # 4) Bursts — to expose the rate-limit gap 
    templates.append({
        "proto": "icmp", "flags": "", "dport": 0,
        "src": "self", "count": 6, "interval": 0.2,
    })
    for port in [80, 8081]:
        templates.append({
            "proto": "tcp", "flags": "S", "dport": port,
            "src": "self", "count": 6, "interval": 0.2,
        })

    return [t for t in templates if contract.is_valid_template(t)]


ACTIONS = build_action_space()


if __name__ == "__main__":
    print(f"action space size: {len(ACTIONS)}")
    # Show a few examples and confirm the key targets are present.
    doors = [i for i, t in enumerate(ACTIONS)
             if t["proto"] == "tcp" and t["dport"] == 8081 and t["flags"] == "S"]
    spoofs = [i for i, t in enumerate(ACTIONS) if t["src"] != "self"]
    bursts = [i for i, t in enumerate(ACTIONS) if t["count"] > 1]
    print(f"templates hitting 8081 with SYN: {len(doors)} (e.g. index {doors[0]})")
    print(f"spoofed-source templates: {len(spoofs)}")
    print(f"burst templates: {len(bursts)}")
    print("example:", ACTIONS[doors[0]])