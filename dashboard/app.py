from flask import Flask, jsonify, render_template  # Import Flask functions.
# Send HTTP requests to check the protected server.
import urllib.request

# Create the dashboard Flask application.
app = Flask(__name__)


# Display the firewall monitoring dashboard.
@app.route("/")
def index():
    return render_template("index.html")


# Check whether the dashboard application is responding.
@app.route("/health")
def health():
    return jsonify(status="online")


# Check whether the protected server is reachable through the firewall.
@app.route("/server-status")
def server_status():
    try:
        # Request the protected server's health endpoint.
        with urllib.request.urlopen(
            "http://192.168.20.10/health", timeout=3
        ) as response:
            return jsonify(status="online" if response.status == 200 else "offline")

    except Exception:
        # Report an offline state if the server cannot be reached.
        return jsonify(status="offline")


# Retrieve real firewall statistics from the read-only monitoring API.
@app.route("/firewall-stats")
def firewall_stats():
    try:
        # Request packet counters from the firewall container.
        with urllib.request.urlopen(
            "http://192.168.10.2:8080/metrics", timeout=3
        ) as response:
            if response.status == 200:
                return jsonify(__import__("json").load(response))

    except Exception:
        # Report unavailable statistics if the firewall cannot be reached.
        pass

    return jsonify(
        status="offline",
        accepted=None,
        dropped=None,
        rejected=None,
        total=None,
    ), 503


# Start the dashboard application.
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)