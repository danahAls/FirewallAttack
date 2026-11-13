// PRIME HR CONSULTING | RED TEAM COMMAND CENTER

const interfaceStatus = document.getElementById("interface-status"); // Backend connection
const learningForm = document.getElementById("learning-form"); // Learning form
const startButton = document.getElementById("start-learning-btn"); // Learning control
const fullAttackButton = document.getElementById("full-attack-btn"); // Full attack control
const controlMessage = document.getElementById("control-message"); // Operation feedback
const runStatus = document.getElementById("run-status"); // Experiment status

const stepsInput = document.getElementById("steps-input"); // Probe count
const epsilonInput = document.getElementById("epsilon-input"); // Exploration probability
const seedInput = document.getElementById("seed-input"); // Random seed

const progressPercentage = document.getElementById("progress-percentage"); // Progress percentage
const progressFill = document.getElementById("progress-fill"); // Progress indicator
const progressTrack = document.getElementById("progress-track"); // Accessible progress
const completedSteps = document.getElementById("completed-steps"); // Completed probes
const totalSteps = document.getElementById("total-steps"); // Total probes
const runId = document.getElementById("run-id"); // Experiment ID

const metricProbes = document.getElementById("metric-probes"); // Total probes
const metricReplies = document.getElementById("metric-replies"); // Received responses
const metricNoReply = document.getElementById("metric-no-reply"); // Missing responses
const metricDiscovery = document.getElementById("metric-discovery"); // Hidden port discovery
const discoveryDetail = document.getElementById("discovery-detail"); // Discovery details

const terminalOutput = document.getElementById("terminal-output"); // Python logs
const resultsBody = document.getElementById("probe-results-body"); // Probe records

const hrAccessStatus = document.getElementById("hr-access-status"); // HR status
const hrDiscoveredPorts = document.getElementById("hr-discovered-ports"); // Discovered ports
const hrInvestigatedPorts = document.getElementById("hr-investigated-ports"); // Investigated ports
const hrAccessConfirmed = document.getElementById("hr-access-confirmed"); // HR access result
const hrAttemptsBody = document.getElementById("hr-access-attempts-body"); // HR attempts
const hrRecordsOutput = document.getElementById("hr-records-output"); // HR records

const REFRESH_INTERVAL = 2000;
const MAX_VISIBLE_RECORDS = 25;

const COLORS = {
    red: "#FF3659",
    green: "#31D79A",
    orange: "#FFB454",
    muted: "#9696A6"
};

let refreshing = false;
let starting = false;
let activeRunId = null;
let activeMode = null;
let lastStatus = null;


// CONNECTION AND EXPERIMENT STATUS

function setConnectionStatus(online) {
    interfaceStatus.textContent = online ? "CONNECTED" : "DISCONNECTED";
    interfaceStatus.style.color = online ? COLORS.green : COLORS.red;
}

function setRunStatus(status) {
    const states = ["idle", "running", "completed", "failed"];
    const current = states.includes(status) ? status : "idle";

    runStatus.className = `status-badge ${current}`;
    runStatus.textContent = current.toUpperCase();
}

function setControlMessage(message, isError = false) {
    controlMessage.textContent = message;
    controlMessage.style.color = isError ? COLORS.red : COLORS.muted;
}

function setButtons(running, mode = null) {
    const busy = running || starting;

    startButton.disabled = busy;
    fullAttackButton.disabled = busy;

    startButton.textContent =
        running && mode === "learning"
            ? "● LEARNING IN PROGRESS"
            : "▶ START LEARNING";

    fullAttackButton.textContent =
        running && mode === "full_attack"
            ? "● FULL ATTACK RUNNING"
            : "⚡ RUN FULL ATTACK";

    [stepsInput, epsilonInput, seedInput].forEach(input => {
        input.disabled = busy;
    });

    fullAttackButton.style.opacity = busy ? "0.55" : "1";
}

function updateProgress(data) {
    const completed = Number(data.completed_steps) || 0;
    const total = Number(data.total_steps) || 0;
    const percentage = total > 0
        ? Math.min(100, completed / total * 100)
        : 0;

    progressPercentage.textContent = `${percentage.toFixed(1)}%`;
    progressFill.style.width = `${percentage}%`;
    progressTrack.setAttribute("aria-valuenow", String(Math.round(percentage)));

    completedSteps.textContent = completed.toLocaleString();
    totalSteps.textContent = total.toLocaleString();
    runId.textContent = data.run_id || "—";
}


// EXISTING ML ANALYTICS

function updateAnalytics(data) {
    metricProbes.textContent =
        Number(data.completed_steps || 0).toLocaleString();

    metricReplies.textContent =
        Number(data.replies_received || 0).toLocaleString();

    metricNoReply.textContent =
        Number(data.no_reply || 0).toLocaleString();

    if (data.hidden_port_discovered) {
        metricDiscovery.textContent = "DISCOVERED";
        metricDiscovery.style.color = COLORS.green;

        discoveryDetail.textContent =
            `First SYN-ACK at step ${data.first_discovery_step} · ` +
            `${data.hidden_port_hits} recorded hit(s)`;
    } else {
        metricDiscovery.textContent = "NOT DETECTED";
        metricDiscovery.style.color = COLORS.orange;
        discoveryDetail.textContent = "No SYN-ACK recorded on port 8081";
    }
}


// LEARNING PERFORMANCE PANEL

function createPerformancePanel() {
    const analytics = document.getElementById("learning-analytics");
    if (!analytics) return null;

    const panel = document.createElement("section");
    panel.className = "panel learning-performance-panel";
    panel.setAttribute("aria-label", "Learning Performance");

    panel.innerHTML = `
        <div class="panel-heading">
            <div>
                <span class="eyebrow">MULTI-ARMED BANDIT ANALYSIS</span>
                <h2><span class="section-icon">◈</span> Learning Performance</h2>
            </div>
            <span class="panel-tag">RECORDED REWARDS</span>
        </div>

        <p class="panel-description">
            Performance metrics calculated from the probe records returned
            by the current experiment.
        </p>

        <div class="performance-summary">
            <div class="performance-stat">
                <span>CUMULATIVE REWARD</span>
                <strong id="performance-reward">0</strong>
            </div>

            <div class="performance-stat">
                <span>BEST PERFORMING ACTION</span>
                <strong id="performance-best">—</strong>
            </div>

            <div class="performance-stat">
                <span>RECORDS ANALYZED</span>
                <strong id="performance-records">0</strong>
            </div>
        </div>

        <div class="performance-table-wrapper">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>ACTION</th>
                        <th>PROTOCOL</th>
                        <th>PORT</th>
                        <th>SELECTION COUNT</th>
                        <th>AVERAGE REWARD</th>
                        <th>FREQUENCY</th>
                    </tr>
                </thead>
                <tbody id="performance-actions-body">
                    <tr>
                        <td colspan="6" class="empty-table">
                            No learning data available.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <p id="performance-note" class="performance-note">
            Start a learning experiment to view action performance.
        </p>
    `;

    analytics.insertAdjacentElement("afterend", panel);

    const styles = document.createElement("style");
    styles.textContent = `
        .learning-performance-panel {
            border-color: rgba(255, 54, 89, 0.28);
        }

        .performance-summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin: 22px 0;
        }

        .performance-stat {
            min-width: 0;
            padding: 20px;
            background: #0E0E14;
            border: 1px solid #2B2934;
            border-radius: 9px;
        }

        .performance-stat span {
            display: block;
            color: #9696A6;
            font-size: 0.67rem;
            font-weight: 800;
            letter-spacing: 0.5px;
        }

        .performance-stat strong {
            display: block;
            margin-top: 11px;
            color: #FF3659;
            font-family: Consolas, monospace;
            font-size: 1.3rem;
            overflow-wrap: anywhere;
        }

        .performance-table-wrapper {
            overflow-x: auto;
            border: 1px solid #2B2934;
            border-radius: 9px;
        }

        .performance-frequency {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 130px;
        }

        .performance-frequency-track {
            flex: 1;
            height: 7px;
            background: #202029;
            border-radius: 10px;
            overflow: hidden;
        }

        .performance-frequency-fill {
            height: 100%;
            background: #FF3659;
            border-radius: inherit;
        }

        .performance-frequency-value {
            min-width: 40px;
            color: #F1F0F4;
            font-size: 0.72rem;
        }

        .performance-note {
            margin-top: 15px;
            color: #9696A6;
            font-size: 0.73rem;
            line-height: 1.7;
        }

        @media (max-width: 760px) {
            .performance-summary {
                grid-template-columns: 1fr;
            }
        }
    `;

    document.head.appendChild(styles);
    return panel;
}

const performancePanel = createPerformancePanel();

function resetPerformance() {
    if (!performancePanel) return;

    document.getElementById("performance-reward").textContent = "0";
    document.getElementById("performance-best").textContent = "—";
    document.getElementById("performance-records").textContent = "0";

    showTableMessage(
        document.getElementById("performance-actions-body"),
        6,
        "No learning data available."
    );

    document.getElementById("performance-note").textContent =
        "Start a learning experiment to view action performance.";
}

function describeAction(record) {
    const template = record.template || {};
    const protocol = String(template.proto || "—").toUpperCase();
    const port = template.dport ?? "—";
    const flags = template.flags || "";
    const source = template.src || "";

    return {
        id: record.arm,
        protocol,
        port,
        label: `${protocol} ${port}${flags ? ` ${flags}` : ""}${source ? ` / ${source}` : ""}`
    };
}

function renderPerformance(records, expectedCount = 0) {
    if (!performancePanel) return;

    if (!Array.isArray(records) || records.length === 0) {
        resetPerformance();
        return;
    }

    const actions = new Map();
    let cumulativeReward = 0;
    let validRecords = 0;

    records.forEach(record => {
        if (!record || record.arm == null) return;

        const reward = Number(record.reward);
        if (!Number.isFinite(reward)) return;

        const id = String(record.arm);
        const description = describeAction(record);

        if (!actions.has(id)) {
            actions.set(id, {
                id,
                ...description,
                count: 0,
                totalReward: 0
            });
        }

        const action = actions.get(id);

        action.count += 1;
        action.totalReward += reward;

        cumulativeReward += reward;
        validRecords += 1;
    });

    if (!validRecords) {
        resetPerformance();
        return;
    }

    const summaries = Array.from(actions.values()).map(action => ({
        ...action,
        average: action.totalReward / action.count,
        frequency: action.count / validRecords * 100
    }));

    summaries.sort((a, b) => {
        return b.average - a.average || b.count - a.count;
    });

    const best = summaries[0];

    document.getElementById("performance-reward").textContent =
        cumulativeReward.toLocaleString("en-US", {
            maximumFractionDigits: 2
        });

    document.getElementById("performance-best").textContent =
        best ? `ARM ${best.id}` : "—";

    document.getElementById("performance-records").textContent =
        validRecords.toLocaleString();

    const body = document.getElementById("performance-actions-body");
    const rows = summaries.map(action => {
        const row = document.createElement("tr");

        createCell(row, `ARM ${action.id}`);
        createCell(row, action.protocol);
        createCell(row, action.port);
        createCell(row, action.count);
        createCell(row, action.average.toFixed(3));

        const frequencyCell = document.createElement("td");
        const wrapper = document.createElement("div");
        const track = document.createElement("div");
        const fill = document.createElement("div");
        const value = document.createElement("span");

        wrapper.className = "performance-frequency";
        track.className = "performance-frequency-track";
        fill.className = "performance-frequency-fill";
        value.className = "performance-frequency-value";

        fill.style.width = `${action.frequency}%`;
        value.textContent = `${action.frequency.toFixed(1)}%`;

        track.appendChild(fill);
        wrapper.append(track, value);
        frequencyCell.appendChild(wrapper);
        row.appendChild(frequencyCell);

        return row;
    });

    body.replaceChildren(...rows);

    const note = document.getElementById("performance-note");
    const partial = expectedCount > validRecords;

    note.textContent = partial
        ? `Analyzed ${validRecords} of ${expectedCount} completed probes. ` +
          "These metrics describe the returned records only."
        : `Calculated from ${validRecords} recorded probes. ` +
          "Average reward represents observed response-based performance, " +
          "not confirmed firewall bypasses.";
}


// TABLE HELPERS

function createCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value == null ? "—" : String(value);
    row.appendChild(cell);
    return cell;
}

function showTableMessage(body, columns, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = columns;
    cell.className = "empty-table";
    cell.textContent = message;

    row.appendChild(cell);
    body.replaceChildren(row);
}


// PROBE RESULTS

function renderResults(records) {
    if (!Array.isArray(records) || records.length === 0) {
        showTableMessage(resultsBody, 7, "No experiment records available.");
        return;
    }

    const rows = records
        .slice(-MAX_VISIBLE_RECORDS)
        .reverse()
        .map(record => {
            const row = document.createElement("tr");
            const template = record.template || {};

            createCell(row, record.step);
            createCell(row, String(template.proto || "—").toUpperCase());
            createCell(row, template.dport);

            createCell(
                row,
                template.proto === "tcp"
                    ? (template.flags || "NULL")
                    : "—"
            );

            createCell(row, template.src);

            const replyCell = createCell(row, record.reply);
            const rewardCell = createCell(row, record.reward);

            if (["synack", "icmp_reply"].includes(record.reply)) {
                replyCell.style.color = COLORS.green;
            } else if (record.reply === "rst") {
                replyCell.style.color = COLORS.orange;
            } else {
                replyCell.style.color = COLORS.muted;
            }

            rewardCell.style.color =
                Number(record.reward) === 1 ? COLORS.green : COLORS.red;

            return row;
        });

    resultsBody.replaceChildren(...rows);
}


// LIVE TERMINAL

function renderLogs(lines, status, mode) {
    if (!Array.isArray(lines) || lines.length === 0) {
        terminalOutput.textContent =
            status === "running"
                ? mode === "full_attack"
                    ? "$ Full attack running. Waiting for Python output..."
                    : "$ Learner running. Waiting for Python output..."
                : "$ No execution output available.";
        return;
    }

    terminalOutput.textContent = lines.join("");
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}


// HR ACCESS RESULTS

function setHRStatus(text, state = "idle") {
    hrAccessStatus.className = `status-badge ${state}`;
    hrAccessStatus.textContent = text;
}

function resetHRResults(message = "No full attack has been run.") {
    setHRStatus("NOT TESTED");

    hrDiscoveredPorts.textContent = "—";
    hrInvestigatedPorts.textContent = "—";

    hrAccessConfirmed.textContent = "NOT TESTED";
    hrAccessConfirmed.style.color = COLORS.muted;

    hrRecordsOutput.textContent = "No confirmed HR records retrieved.";
    showTableMessage(hrAttemptsBody, 4, message);
}

function formatPorts(ports) {
    return Array.isArray(ports) && ports.length
        ? ports.join(", ")
        : "NONE";
}

function renderHRAttempts(attempts) {
    if (!Array.isArray(attempts) || attempts.length === 0) {
        showTableMessage(hrAttemptsBody, 4, "No HR access attempts recorded.");
        return;
    }

    const rows = attempts.map(attempt => {
        const row = document.createElement("tr");

        createCell(row, attempt.port);
        createCell(row, attempt.path);
        createCell(row, attempt.http_status);

        const confirmed = Boolean(attempt.access_confirmed);
        const statusCell = createCell(
            row,
            confirmed ? "CONFIRMED" : "NOT CONFIRMED"
        );

        statusCell.style.color =
            confirmed ? COLORS.green : COLORS.orange;

        return row;
    });

    hrAttemptsBody.replaceChildren(...rows);
}

function renderHRRecords(records) {
    if (records == null) {
        hrRecordsOutput.textContent = "No confirmed HR records retrieved.";
        return;
    }

    const emptyArray = Array.isArray(records) && records.length === 0;
    const emptyObject =
        typeof records === "object" &&
        !Array.isArray(records) &&
        Object.keys(records).length === 0;

    if (emptyArray || emptyObject) {
        hrRecordsOutput.textContent =
            "No HR records available in the verified response.";
        return;
    }

    hrRecordsOutput.textContent = JSON.stringify(records, null, 2);
}

function renderAttackResults(data) {
    if (!data || data.mode !== "full_attack") {
        resetHRResults();
        return;
    }

    const findings = data.findings;

    if (!findings) {
        resetHRResults(
            data.status === "running"
                ? "Full attack started. Waiting for findings..."
                : "No attack findings available."
        );

        if (data.status === "running") {
            setHRStatus("IN PROGRESS", "running");
        }

        return;
    }

    const discovered = findings.discovered_ports || [];
    const investigated = findings.investigated_ports || [];
    const attempts = findings.access_results || [];

    hrDiscoveredPorts.textContent = formatPorts(discovered);
    hrInvestigatedPorts.textContent = formatPorts(investigated);

    renderHRAttempts(attempts);

    if (findings.hr_access_confirmed) {
        setHRStatus("ACCESS CONFIRMED", "failed");

        hrAccessConfirmed.textContent = "CONFIRMED";
        hrAccessConfirmed.style.color = COLORS.red;

        renderHRRecords(findings.hr_records);

    } else if (data.status === "running") {
        setHRStatus("IN PROGRESS", "running");

        hrAccessConfirmed.textContent = "PENDING";
        hrAccessConfirmed.style.color = COLORS.orange;

        hrRecordsOutput.textContent =
            "Experiment running. HR access has not been confirmed.";

    } else if (data.status === "failed") {
        setHRStatus("EXPERIMENT FAILED", "failed");

        hrAccessConfirmed.textContent = "UNKNOWN";
        hrAccessConfirmed.style.color = COLORS.red;

        hrRecordsOutput.textContent =
            "Experiment failed before access could be fully verified.";

    } else {
        setHRStatus("NOT CONFIRMED", "completed");

        hrAccessConfirmed.textContent = "NOT CONFIRMED";
        hrAccessConfirmed.style.color = COLORS.orange;

        hrRecordsOutput.textContent =
            "No confirmed access to simulated employee records.";
    }
}


// BACKEND COMMUNICATION

async function fetchJson(path, options = {}) {
    const response = await fetch(path, {
        cache: "no-store",
        ...options
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `Invalid server response (HTTP ${response.status})`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.error || `Request failed (HTTP ${response.status})`
        );
    }

    return data;
}

async function refreshInterface(force = false) {
    if (refreshing || (starting && !force)) return;

    refreshing = true;

    try {
        const status = await fetchJson("/api/status");

        setConnectionStatus(true);
        setRunStatus(status.status);
        setButtons(status.status === "running", status.mode);

        updateProgress(status);
        updateAnalytics(status);

        const runChanged = status.run_id !== activeRunId;
        const modeChanged = status.mode !== activeMode;

        if (runChanged || modeChanged) {
            activeRunId = status.run_id;
            activeMode = status.mode;
            lastStatus = null;

            terminalOutput.textContent = "$ Loading experiment logs...";

            showTableMessage(
                resultsBody,
                7,
                "Loading experiment records..."
            );

            resetHRResults();
            resetPerformance();
        }

        if (status.status !== lastStatus) {
            if (status.status === "running") {
                setControlMessage(
                    status.mode === "full_attack"
                        ? "Full attack running. Monitoring learning and investigation."
                        : "Learning experiment running. Collecting network responses."
                );

            } else if (status.status === "completed") {
                setControlMessage(
                    status.mode === "full_attack"
                        ? "Full attack completed. Investigation results are available."
                        : "Learning completed. Results are ready."
                );

            } else if (status.status === "failed") {
                setControlMessage(
                    status.error || "Experiment failed. Check execution logs.",
                    true
                );

            } else {
                setControlMessage("Ready to initialize a new experiment.");
            }

            lastStatus = status.status;
        }

        const requests = [
            fetchJson("/api/results"),
            fetchJson("/api/logs")
        ];

        if (status.mode === "full_attack") {
            requests.push(fetchJson("/api/attack-results"));
        }

        const responses = await Promise.all(requests);
        const records = responses[0].records || [];

        renderResults(records);
        renderPerformance(records, Number(status.completed_steps) || 0);
        renderLogs(responses[1].logs, status.status, status.mode);

        if (status.mode === "full_attack") {
            renderAttackResults(responses[2]);
        } else {
            resetHRResults();
        }

    } catch (error) {
        setConnectionStatus(false);
        setControlMessage(`Connection error: ${error.message}`, true);

    } finally {
        refreshing = false;
    }
}


// EXPERIMENT CONTROL

function readConfiguration(fullAttack = false) {
    const steps = fullAttack ? 400 : Number(stepsInput.value);
    const epsilon = Number(epsilonInput.value);
    const seed = Number(seedInput.value);

    if (!Number.isInteger(steps) || steps < 1 || steps > 400) {
        throw new Error("Probe steps must be between 1 and 400.");
    }

    if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) {
        throw new Error("Epsilon must be between 0 and 1.");
    }

    if (!Number.isInteger(seed) || seed < 0 || seed > 1000000) {
        throw new Error("Random seed must be between 0 and 1000000.");
    }

    return { steps, epsilon, seed };
}

async function launchExperiment(mode) {
    if (starting || refreshing) return;

    let configuration;

    try {
        configuration = readConfiguration(mode === "full_attack");
    } catch (error) {
        setControlMessage(error.message, true);
        return;
    }

    starting = true;
    setButtons(true, mode);

    const fullAttack = mode === "full_attack";

    setControlMessage(
        fullAttack
            ? "Starting full attack simulation..."
            : "Starting learning experiment..."
    );

    try {
        const endpoint = fullAttack
            ? "/api/full-attack"
            : "/api/start";

        const response = await fetchJson(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(configuration)
        });

        activeRunId = response.run_id;
        activeMode = mode;
        lastStatus = null;

        setRunStatus("running");

        terminalOutput.textContent =
            "$ Experiment initialized. Waiting for Python output...";

        showTableMessage(
            resultsBody,
            7,
            "Waiting for recorded probes..."
        );

        resetPerformance();

        resetHRResults(
            fullAttack
                ? "Waiting for HR investigation results..."
                : "No full attack has been run."
        );

        if (fullAttack) {
            setHRStatus("IN PROGRESS", "running");
        }

        setControlMessage(
            fullAttack
                ? "Full attack started. Monitoring 400 probes and HR investigation."
                : "Learning started. Monitoring network responses."
        );

    } catch (error) {
        setControlMessage(`Unable to start: ${error.message}`, true);

    } finally {
        starting = false;
        await refreshInterface(true);
    }
}

async function startLearning(event) {
    event.preventDefault();
    await launchExperiment("learning");
}

async function startFullAttack() {
    await launchExperiment("full_attack");
}


// NAVIGATION

function initializeNavigation() {
    const links = document.querySelectorAll(".sidebar-nav .nav-link");

    function updateActiveLink() {
        const hash = window.location.hash || "#overview";

        links.forEach(link => {
            link.classList.toggle(
                "active",
                link.getAttribute("href") === hash
            );
        });
    }

    links.forEach(link => {
        link.addEventListener("click", () => {
            links.forEach(item => item.classList.remove("active"));
            link.classList.add("active");
        });
    });

    window.addEventListener("hashchange", updateActiveLink);
    updateActiveLink();
}


// INITIALIZATION

learningForm.addEventListener("submit", startLearning);
fullAttackButton.addEventListener("click", startFullAttack);

initializeNavigation();
refreshInterface();
setInterval(refreshInterface, REFRESH_INTERVAL);