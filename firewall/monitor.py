import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer


# Read the firewall's real packet counters from the FORWARD chain.
def get_firewall_metrics():
    result = subprocess.run(
        ["iptables", "-L", "FORWARD", "-n", "-v", "-x"],
        capture_output=True,
        text=True,
        check=True,
        timeout=3,
    )

    accepted = 0
    dropped = 0
    rejected = 0

    # Count packets according to the action of each firewall rule.
    for line in result.stdout.splitlines():
        columns = line.split()

#Count packets dropped by our defult rules, like 443
        if line.startswith("Chain FORWARD") and "policy DROP" in line:
            dropped += int(columns[4])
            continue

        if len(columns) < 3 or not columns[0].isdigit():
            continue

        if len(columns) < 3 or not columns[0].isdigit():
            continue

        packets = int(columns[0])
        action = columns[2]

        if action == "ACCEPT":
            accepted += packets
        elif action == "DROP":
            dropped += packets
        elif action == "REJECT":
            rejected += packets

    return {
        "status": "online",
        "accepted": accepted,
        "dropped": dropped,
        "rejected": rejected,
        "total": accepted + dropped + rejected,
    }


# Expose firewall statistics through a read-only HTTP endpoint.
class MonitoringHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_error(404)
            return

        try:
            metrics = get_firewall_metrics()
            response = json.dumps(metrics).encode("utf-8")
            status_code = 200

        except (subprocess.SubprocessError, OSError):
            # Return an error if firewall counters cannot be read.
            response = json.dumps({"status": "error"}).encode("utf-8")
            status_code = 503

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


# Listen on the Docker network without publishing a host port.
if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), MonitoringHandler).serve_forever()