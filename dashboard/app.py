from flask import Flask, jsonify, render_template, request
import json
import time
import urllib.request
import urllib.error

app = Flask(__name__)

SERVER_URL = "http://192.168.20.10" # Protected company server
FIREWALL_URL = "http://192.168.10.2:8080" # Firewall monitoring API
ATTACKER_URL = "http://192.168.10.3:5001" # Attacker experiment interface

NORMAL_SERVICES = { # Approved employee services for normal traffic
    "company": "/api/company",
    "employees": "/api/employees",
    "services": "/api/services"
}


@app.route("/")
def index(): # Display the company security dashboard
    return render_template("index.html")


@app.route("/health")
def health(): # Check dashboard availability
    return jsonify(status="online")


@app.route("/server-status")
def server_status(): # Check the protected server through the firewall
    try:
        with urllib.request.urlopen(f"{SERVER_URL}/health", timeout=3) as response:
            data = json.load(response)
            return jsonify(
                status="online" if response.status == 200
                and data.get("status") in ("ok", "online") else "offline"
            )
    except Exception:
        return jsonify(status="offline")


@app.route("/firewall-stats")
def firewall_stats(): # Retrieve actual iptables statistics
    try:
        with urllib.request.urlopen(f"{FIREWALL_URL}/metrics", timeout=3) as response:
            if response.status == 200:
                return jsonify(json.load(response))
    except Exception:
        pass

    return jsonify(
        status="offline",
        accepted=None,
        dropped=None,
        rejected=None,
        total=None
    ), 503


@app.route("/packet-events")
def packet_events(): # Retrieve real packet events recorded by NFLOG
    try:
        with urllib.request.urlopen(f"{FIREWALL_URL}/events", timeout=3) as response:
            if response.status == 200:
                return jsonify(json.load(response))
    except Exception:
        pass

    return jsonify(
        status="offline",
        events=[],
        total=0,
        error="Firewall packet monitoring unavailable"
    ), 503


@app.route("/security-alerts")
def security_alerts(): # Retrieve blocked traffic events recorded by NFLOG
    try:
        with urllib.request.urlopen(f"{FIREWALL_URL}/alerts", timeout=3) as response:
            if response.status == 200:
                return jsonify(json.load(response))
    except Exception:
        pass

    return jsonify(
        status="offline",
        alerts=[],
        total=0,
        error="Firewall security alerts unavailable"
    ), 503


@app.route("/employee-api/<service>")
def employee_api(service): # Forward approved employee requests to the server
    if service not in NORMAL_SERVICES:
        return jsonify(error="Unknown employee service"), 404

    try:
        endpoint = NORMAL_SERVICES[service] # Select the requested company service

        with urllib.request.urlopen(f"{SERVER_URL}{endpoint}", timeout=5) as response:
            data = json.load(response)
            return jsonify(data), response.status

    except urllib.error.HTTPError as error:
        return jsonify(
            error="Protected server rejected the request",
            status=error.code
        ), 502

    except Exception:
        return jsonify(error="Protected server unavailable"), 502


@app.route("/normal-traffic", methods=["POST"])
def normal_traffic(): # Generate authorized HTTP traffic through existing firewall rules
    data = request.get_json(silent=True) or {}

    try:
        count = int(data.get("count", 10)) # Number of normal HTTP requests
    except (ValueError, TypeError):
        return jsonify(error="Invalid request count"), 400

    if not 1 <= count <= 20: # Limit the number of requests per simulation
        return jsonify(error="Request count must be between 1 and 20"), 400

    traffic_services = [
        {
            "name": "Company Information",
            "url": f"{SERVER_URL}/api/company",
            "port": 80,
            "destination": "192.168.20.10"
        },
        {
            "name": "Employee Directory",
            "url": f"{SERVER_URL}/api/employees",
            "port": 80,
            "destination": "192.168.20.10"
        },
        {
            "name": "Service Availability",
            "url": f"{SERVER_URL}/api/services",
            "port": 80,
            "destination": "192.168.20.10"
        },
        {
            "name": "HR Portal Homepage",
            "url": "http://192.168.20.10:9000/",
            "port": 9000,
            "destination": "192.168.20.10"
        },
        {
            "name": "HR Portal DNAT",
            "url": "http://192.168.10.2:8081/",
            "port": 8081,
            "destination": "192.168.10.2"
        }
    ] # Tested company services and HR portal endpoints

    results = []
    successful = 0
    failed = 0

    for i in range(count):
        service = traffic_services[i % len(traffic_services)] # Rotate between normal services

        try:
            http_request = urllib.request.Request(
                service["url"],
                headers={
                    "User-Agent": "Triple4Recruitment-NormalTraffic/1.0",
                    "Connection": "close" # Create a separate TCP connection for each request
                }
            )

            with urllib.request.urlopen(http_request, timeout=5) as response:
                status = response.status # Record the actual HTTP response
                response.read() # Receive the complete server response

            result = "SUCCESS" if status == 200 else "HTTP ERROR"

        except urllib.error.HTTPError as error:
            status = error.code
            result = "HTTP ERROR"

        except Exception:
            status = None
            result = "NO RESPONSE"

        if result == "SUCCESS":
            successful += 1
        else:
            failed += 1

        results.append({ # Store the outcome of each HTTP request
            "request": i + 1,
            "source": "192.168.10.4",
            "destination": service["destination"],
            "protocol": "HTTP/TCP",
            "port": service["port"],
            "service": service["name"],
            "http_status": status,
            "result": result
        })

        time.sleep(0.15) # Space out requests for firewall monitoring

    return jsonify({ # Return the traffic summary to the dashboard
        "status": "completed",
        "traffic_type": "NORMAL",
        "requests_sent": count,
        "successful_responses": successful,
        "failed_requests": failed,
        "source_ip": "192.168.10.4",
        "firewall_verification": "Check NFLOG events for firewall decisions",
        "results": results
    })


@app.route("/attack-status")
def attack_status(): # Read simulated attack findings without exposing HR records
    try:
        with urllib.request.urlopen(
            f"{ATTACKER_URL}/api/attack-results",
            timeout=3
        ) as response:
            if response.status != 200:
                raise ValueError("Attacker service returned an invalid response")

            data = json.load(response)

        mode = data.get("mode")
        status = data.get("status", "idle")
        findings = data.get("findings") or {}

        if mode != "full_attack":
            return jsonify(
                status="idle",
                mode=mode,
                run_id=data.get("run_id"),
                hr_access_confirmed=False,
                alert_level="none",
                message="No full attack result is currently selected"
            )

        access_results = findings.get("access_results") or []

        confirmed_access = ( # Confirm HR access using the recorded HTTP results
            findings.get("hr_access_confirmed") is True
            and any(
                result.get("path") == "/salaries"
                and result.get("http_status") == 200
                and result.get("access_confirmed") is True
                for result in access_results
                if isinstance(result, dict)
            )
        )

        completed = ( # Verify that the full attack experiment has finished
            status == "completed"
            and findings.get("status") == "completed"
        )

        if completed and confirmed_access:
            alert_level = "critical"
            message = "Simulated HR data access confirmed"

        elif status == "running":
            alert_level = "info"
            message = "Full attack experiment in progress"

        elif status == "failed":
            alert_level = "warning"
            message = "Full attack experiment failed"

        elif completed:
            alert_level = "none"
            message = "No confirmed HR data access in this experiment"

        else:
            alert_level = "none"
            message = "Attack results are not yet available"

        return jsonify( # Send the security status without HR record contents
            status=status,
            mode=mode,
            run_id=data.get("run_id"),
            target_ip=findings.get("target_ip"),
            discovered_ports=findings.get("discovered_ports", []),
            investigated_ports=findings.get("investigated_ports", []),
            hr_access_confirmed=confirmed_access if completed else False,
            finished_at=findings.get("finished_at"),
            alert_level=alert_level,
            message=message
        )

    except Exception:
        return jsonify(
            status="offline",
            hr_access_confirmed=False,
            alert_level="unavailable",
            error="Attacker experiment status unavailable"
        ), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)