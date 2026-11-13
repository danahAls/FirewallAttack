
from flask import Flask, jsonify, request
from datetime import datetime

app = Flask(__name__)

EMPLOYEES = [
    {"name": "Danah",  "role": "Engineer",       "salary": 100000},
    {"name": "Yara",  "role": "Manager & HR",     "salary": 50000},
    {"name": "Layan",  "role": "Top tier hacker",     "salary": 50000},
    {"name": "Hala",  "role": "Artist",            "salary": 45000},
    {"name": "Tala",  "role": "Designer",            "salary": 45000},
]

def log_hit(path):
       line = f"{datetime.utcnow().isoformat()} HR-HIT from {request.remote_addr} {path}\n"
       try:
           with open("/results/hr_access.log", "a") as f:
               f.write(line)
       except OSError:
           pass
       print("[hr]", line.strip())


@app.route("/")
def index():
    log_hit("/")
    return (
        "<h1>HR Portal (INTERNAL)</h1>"
        "<p>Employee records system. Authorized staff only.</p>"
        "<ul><li><a href='/salaries'>/salaries</a> — full salary table (JSON)</li></ul>"
    )



@app.route("/salaries")
def salaries():
    log_hit("/salaries")
    return jsonify(confidential=True, employees=EMPLOYEES)

if __name__ == "__main__":
    # Listen on all interfaces, port 9000.
    app.run(host="0.0.0.0", port=9000)