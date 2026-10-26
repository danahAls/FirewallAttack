from flask import Flask, jsonify, render_template

app = Flask(__name__)


# Display the protected web server interface.
@app.route("/")
def index():
    return render_template("index.html")


# Check whether the Flask server is responding.
# Keep the original response for compatibility.
@app.route("/health")
def health():
    return jsonify(status="ok")


# Start the Flask server.
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)