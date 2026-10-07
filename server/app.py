from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def index():
    return "<h1>Lab Web Server</h1><p>The server is working.</p>"


@app.route("/health")
def health():
    return jsonify(status="ok")


if __name__ == "__main__":
    # host="0.0.0.0" means "listen on all network interfaces", not just
    # localhost — this is required so connections from outside the container
    # (your browser, and later the firewall) can reach it.
    app.run(host="0.0.0.0", port=80)