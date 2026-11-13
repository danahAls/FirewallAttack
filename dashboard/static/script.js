// TRIPLE 4 RECRUITMENT | COMPANY SECURITY DASHBOARD

const serverStatus = document.getElementById("server-status"); // Protected server status
const firewallStatus = document.getElementById("firewall-status"); // Firewall status
const totalPackets = document.getElementById("total-packets"); // Total packets
const acceptedPackets = document.getElementById("accepted-packets"); // Accepted packets
const droppedPackets = document.getElementById("dropped-packets"); // Dropped packets
const rejectedPackets = document.getElementById("rejected-packets"); // Rejected packets

const trafficCanvas = document.getElementById("traffic-chart"); // Traffic chart
const distributionCanvas = document.getElementById("distribution-chart"); // Distribution chart
const acceptedPercentage = document.getElementById("accepted-percentage");
const droppedPercentage = document.getElementById("dropped-percentage");
const rejectedPercentage = document.getElementById("rejected-percentage");

const companyButton = document.getElementById("company-info-btn");
const employeesButton = document.getElementById("employee-directory-btn");
const servicesButton = document.getElementById("service-check-btn");
const serviceResult = document.getElementById("employee-service-result");

const trafficHistory = []; // Recent packet changes
const MAX_HISTORY = 20;
const MAX_VISIBLE_EVENTS = 12;
const REFRESH_INTERVAL = 2000; // Refresh every two seconds

let previousCounters = null;
let latestCounters = null;
let serverChecking = false;
let firewallChecking = false;
let packetEventsChecking = false;
let securityAlertsChecking = false;

const colors = {
    teal: "#30C4B5",
    green: "#22C55E",
    red: "#EF4444",
    purple: "#A78BFA",
    muted: "#9DAAB5",
    grid: "#37434B"
};


// SYSTEM STATUS

function updateStatus(element, status) { // Update status indicators
    if (!element) return;

    const online = status === "online";

    element.textContent = online ? "Online" : "Offline";
    element.classList.toggle("online", online);
    element.classList.toggle("offline", !online);
}


async function checkServerStatus() { // Check protected server availability
    if (serverChecking) return;

    serverChecking = true;

    try {
        const response = await fetch("/server-status", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Server status unavailable");
        }

        const data = await response.json();
        updateStatus(serverStatus, data.status);

    } catch {
        updateStatus(serverStatus, "offline");

    } finally {
        serverChecking = false;
    }
}


// CHART CONFIGURATION

function setCanvasSize(canvas) { // Set responsive chart dimensions
    const scale = window.devicePixelRatio || 1;
    const isDistribution = canvas.id === "distribution-chart";

    const width = isDistribution
        ? 180
        : Math.max(1, canvas.parentElement.clientWidth - 2);

    const height = isDistribution ? 180 : 235;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    return { ctx, width, height };
}


function hideChartPlaceholder(canvas) { // Hide loading message
    const placeholder = canvas.parentElement.querySelector(".chart-placeholder");

    if (placeholder) placeholder.style.display = "none";
}


function showChartPlaceholder(canvas) { // Display loading message
    const placeholder = canvas.parentElement.querySelector(".chart-placeholder");

    if (placeholder) placeholder.style.display = "block";
}


// NETWORK TRAFFIC CHART

function drawTrafficChart() { // Draw real network traffic changes
    if (!trafficCanvas || trafficHistory.length === 0) return;

    const { ctx, width, height } = setCanvasSize(trafficCanvas);

    ctx.clearRect(0, 0, width, height);

    const left = 42;
    const right = 18;
    const top = 20;
    const bottom = 34;

    const chartWidth = Math.max(1, width - left - right);
    const chartHeight = Math.max(1, height - top - bottom);

    const maxValue = Math.max(
        5,
        ...trafficHistory.map(item => item.count)
    );

    const gridLines = 4;

    ctx.font = "11px Segoe UI";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= gridLines; i++) {
        const value = maxValue * (gridLines - i) / gridLines;
        const y = top + chartHeight * i / gridLines;

        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();

        ctx.fillStyle = colors.muted;

        ctx.fillText(
            Math.round(value).toLocaleString(),
            left - 9,
            y
        );
    }

    const points = trafficHistory.map((item, index) => ({
        x: left + index * chartWidth / Math.max(1, MAX_HISTORY - 1),
        y: top + chartHeight - item.count / maxValue * chartHeight
    }));

    const gradient = ctx.createLinearGradient(
        0,
        top,
        0,
        top + chartHeight
    );

    gradient.addColorStop(0, "rgba(48, 196, 181, 0.30)");
    gradient.addColorStop(1, "rgba(48, 196, 181, 0.01)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, top + chartHeight);

    points.forEach(point => {
        ctx.lineTo(point.x, point.y);
    });

    ctx.lineTo(
        points[points.length - 1].x,
        top + chartHeight
    );

    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();

    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });

    ctx.strokeStyle = colors.teal;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    const lastPoint = points[points.length - 1];

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.teal;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.muted;

    trafficHistory.forEach((item, index) => {
        if (
            index % 4 !== 0 &&
            index !== trafficHistory.length - 1
        ) return;

        ctx.fillText(
            item.time,
            points[index].x,
            height - bottom + 11
        );
    });

    hideChartPlaceholder(trafficCanvas);
}


// PACKET DISTRIBUTION CHART

function drawDistributionChart(data) { // Draw real firewall packet distribution
    if (!distributionCanvas) return;

    const { ctx, width, height } = setCanvasSize(distributionCanvas);

    ctx.clearRect(0, 0, width, height);

    const accepted = data.accepted;
    const dropped = data.dropped;
    const rejected = data.rejected;
    const total = accepted + dropped + rejected;

    const centerX = width / 2;
    const centerY = height / 2;

    const radius = Math.min(width, height) / 2 - 14;
    const lineWidth = 20;
    const circleRadius = radius - lineWidth / 2;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";
    ctx.strokeStyle = colors.grid;

    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (total > 0) {
        const segments = [
            { value: accepted, color: colors.green },
            { value: dropped, color: colors.red },
            { value: rejected, color: colors.purple }
        ];

        let startAngle = -Math.PI / 2;

        segments.forEach(segment => {
            if (segment.value === 0) return;

            const endAngle =
                startAngle + segment.value / total * Math.PI * 2;

            ctx.beginPath();
            ctx.arc(
                centerX,
                centerY,
                circleRadius,
                startAngle,
                endAngle
            );

            ctx.strokeStyle = segment.color;
            ctx.stroke();

            startAngle = endAngle;
        });
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.teal;
    ctx.font = "bold 25px Segoe UI";

    ctx.fillText(
        total.toLocaleString(),
        centerX,
        centerY - 7
    );

    ctx.fillStyle = colors.muted;
    ctx.font = "12px Segoe UI";
    ctx.fillText("Packets", centerX, centerY + 18);

    if (acceptedPercentage) {
        acceptedPercentage.textContent = total
            ? `${(accepted / total * 100).toFixed(1)}%`
            : "0%";
    }

    if (droppedPercentage) {
        droppedPercentage.textContent = total
            ? `${(dropped / total * 100).toFixed(1)}%`
            : "0%";
    }

    if (rejectedPercentage) {
        rejectedPercentage.textContent = total
            ? `${(rejected / total * 100).toFixed(1)}%`
            : "0%";
    }

    hideChartPlaceholder(distributionCanvas);
}


// FIREWALL STATISTICS

async function checkFirewallStatus() { // Retrieve real firewall statistics
    if (firewallChecking) return;

    firewallChecking = true;

    try {
        const response = await fetch("/firewall-stats", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Firewall statistics unavailable");
        }

        const data = await response.json();

        if (data.status !== "online") {
            throw new Error("Firewall monitoring offline");
        }

        const counters = {
            total: Number(data.total),
            accepted: Number(data.accepted),
            dropped: Number(data.dropped),
            rejected: Number(data.rejected)
        };

        if (
            Object.values(counters).some(
                value => !Number.isFinite(value) || value < 0
            )
        ) {
            throw new Error("Invalid firewall counters");
        }

        updateStatus(firewallStatus, "online");

        if (totalPackets) {
            totalPackets.textContent = counters.total.toLocaleString();
        }

        if (acceptedPackets) {
            acceptedPackets.textContent = counters.accepted.toLocaleString();
        }

        if (droppedPackets) {
            droppedPackets.textContent = counters.dropped.toLocaleString();
        }

        if (rejectedPackets) {
            rejectedPackets.textContent = counters.rejected.toLocaleString();
        }

        if (previousCounters !== null) {
            const restarted = Object.keys(counters).some(
                key => counters[key] < previousCounters[key]
            );

            if (restarted) {
                trafficHistory.length = 0;

            } else {
                const difference = Math.max(
                    0,
                    counters.total - previousCounters.total
                );

                trafficHistory.push({
                    count: difference,
                    time: new Date().toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                    })
                });

                if (trafficHistory.length > MAX_HISTORY) {
                    trafficHistory.shift();
                }
            }
        }

        previousCounters = counters;
        latestCounters = counters;

        drawTrafficChart();
        drawDistributionChart(counters);

    } catch {
        updateStatus(firewallStatus, "offline");

        [
            totalPackets,
            acceptedPackets,
            droppedPackets,
            rejectedPackets
        ].forEach(element => {
            if (element) element.textContent = "Unavailable";
        });

        [
            acceptedPercentage,
            droppedPercentage,
            rejectedPercentage
        ].forEach(element => {
            if (element) element.textContent = "--";
        });

        previousCounters = null;
        latestCounters = null;
        trafficHistory.length = 0;

        [trafficCanvas, distributionCanvas].forEach(canvas => {
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            showChartPlaceholder(canvas);
        });

    } finally {
        firewallChecking = false;
    }
}


// EMPLOYEE SERVICES

function createResultItem(label, value) { // Create employee service result
    const item = document.createElement("div");
    const field = document.createElement("span");
    const content = document.createElement("strong");

    item.className = "employee-result-item";
    field.textContent = label;
    content.textContent = String(value ?? "N/A");

    item.append(field, content);

    return item;
}


function displayServiceResult(title, records) { // Display company service data
    if (!serviceResult) return;

    serviceResult.replaceChildren();
    serviceResult.hidden = false;

    const heading = document.createElement("h3");
    const grid = document.createElement("div");

    heading.textContent = title;
    grid.className = "employee-result-grid";

    records.forEach(record => {
        grid.appendChild(
            createResultItem(record.label, record.value)
        );
    });

    serviceResult.append(heading, grid);
}


function displayServiceError(message) { // Display request errors
    if (!serviceResult) return;

    serviceResult.replaceChildren();
    serviceResult.hidden = false;

    const error = document.createElement("p");

    error.className = "employee-result-error";
    error.textContent = message;

    serviceResult.appendChild(error);
}


function formatServiceData(service, data) { // Format employee API responses
    if (service === "company") {
        return [
            { label: "Company Name", value: data.name },
            { label: "Industry", value: data.industry },
            { label: "Location", value: data.location },
            { label: "Slogan", value: data.slogan },
            { label: "Company Status", value: data.status }
        ];
    }

    if (service === "employees") {
        if (!Array.isArray(data.employees)) {
            throw new Error("Invalid employee directory");
        }

        return data.employees.flatMap(employee => [
            {
                label: `${employee.id} | Employee`,
                value: employee.name
            },
            {
                label: "Department & Role",
                value: `${employee.department} | ${employee.role}`
            }
        ]);
    }

    if (service === "services") {
        return [
            {
                label: "Company Portal",
                value: data.company_portal
            },
            {
                label: "Employee Directory",
                value: data.employee_directory
            },
            {
                label: "Health Endpoint",
                value: data.health_endpoint
            }
        ];
    }

    throw new Error("Unknown employee service");
}


async function requestEmployeeService(service, title, button) { // Request employee services
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Loading...";

    try {
        const response = await fetch(`/employee-api/${service}`, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const records = formatServiceData(service, data);

        displayServiceResult(title, records);

    } catch (error) {
        displayServiceError(
            `Request failed: ${error.message}`
        );

    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}


function activateEmployeeService(button, service, title, label) { // Enable employee service buttons
    if (!button || !serviceResult) return;

    button.disabled = false;
    button.textContent = label;

    button.addEventListener("click", () => {
        requestEmployeeService(service, title, button);
    });
}


// PACKET MONITORING

function findMonitoringTarget(ids) { // Find monitoring display container
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element) return element;
    }

    return null;
}


function formatEventTime(value) { // Convert UTC timestamps to local time
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown";
    }

    return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


function showMonitoringMessage(target, message, columnCount = 1) { // Show empty or offline state
    if (!target) return;

    if (target.tagName === "TBODY") {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = columnCount;
        cell.textContent = message;

        row.appendChild(cell);
        target.replaceChildren(row);
        return;
    }

    const note = document.createElement("p");
    note.textContent = message;

    target.replaceChildren(note);
}


function addEventCell(row, value) { // Insert packet information safely
    const cell = document.createElement("td");

    cell.textContent = value == null
        ? "—"
        : String(value);

    row.appendChild(cell);

    return cell;
}


function renderPacketEvents(items) { // Display real NFLOG packet events
    const target = findMonitoringTarget([
        "packet-events-body",
        "traffic-table-body",
        "live-traffic-body",
        "traffic-events-body"
    ]);

    if (!target) return;

    if (!items.length) {
        showMonitoringMessage(
            target,
            "No recorded traffic yet",
            6
        );
        return;
    }

    const rows = items
        .slice(0, MAX_VISIBLE_EVENTS)
        .map(event => {
            const row = document.createElement("tr");

            addEventCell(row, formatEventTime(event.time));
            addEventCell(row, event.source_ip);
            addEventCell(row, event.destination_ip);
            addEventCell(row, event.protocol);
            addEventCell(row, event.port);

            const decision = addEventCell(row, event.decision);

            decision.style.color =
                event.decision === "ACCEPT"
                    ? colors.green
                    : event.decision === "REJECT"
                        ? colors.purple
                        : colors.red;

            decision.style.fontWeight = "700";

            return row;
        });

    target.replaceChildren(...rows);
}


function renderSecurityAlerts(items) { // Display blocked packet events
    const target = findMonitoringTarget([
        "security-alerts-list",
        "alerts-list",
        "security-alerts-body",
        "alerts-container"
    ]);

    if (!target) return;

    if (!items.length) {
        showMonitoringMessage(
            target,
            "No blocked traffic recorded"
        );
        return;
    }

    const cards = items
        .slice(0, MAX_VISIBLE_EVENTS)
        .map(event => {
            const card = document.createElement("div");
            const title = document.createElement("strong");
            const detail = document.createElement("p");

            card.className = "security-alert-item";

            title.textContent =
                `${event.decision} · ${event.protocol} · Port ${event.port ?? "—"}`;

            title.style.color =
                event.decision === "REJECT"
                    ? colors.purple
                    : colors.red;

            detail.textContent =
                `${event.source_ip} → ${event.destination_ip} · ${formatEventTime(event.time)}`;

            card.append(title, detail);

            return card;
        });

    target.replaceChildren(...cards);
}


async function refreshPacketEvents() { // Fetch real packet events
    if (packetEventsChecking) return;

    packetEventsChecking = true;

    const target = findMonitoringTarget([
        "packet-events-body",
        "traffic-table-body",
        "live-traffic-body",
        "traffic-events-body"
    ]);

    try {
        const response = await fetch("/packet-events", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Packet monitoring unavailable");
        }

        const data = await response.json();

        if (
            data.status !== "online" ||
            !Array.isArray(data.events)
        ) {
            throw new Error("Invalid packet events");
        }

        renderPacketEvents(data.events);

    } catch {
        showMonitoringMessage(
            target,
            "Live traffic unavailable",
            6
        );

    } finally {
        packetEventsChecking = false;
    }
}


async function refreshSecurityAlerts() { // Fetch real blocked packet events
    if (securityAlertsChecking) return;

    securityAlertsChecking = true;

    const target = findMonitoringTarget([
        "security-alerts-list",
        "alerts-list",
        "security-alerts-body",
        "alerts-container"
    ]);

    try {
        const response = await fetch("/security-alerts", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Security alerts unavailable");
        }

        const data = await response.json();

        if (
            data.status !== "online" ||
            !Array.isArray(data.alerts)
        ) {
            throw new Error("Invalid security alerts");
        }

        renderSecurityAlerts(data.alerts);

    } catch {
        showMonitoringMessage(
            target,
            "Security alerts unavailable"
        );

    } finally {
        securityAlertsChecking = false;
    }
}


// SECURITY INCIDENT MONITOR

const incidentState = {
    firewallInitialized: false,
    knownEvents: new Set(),
    attackInitialized: false,
    observedRunId: null,
    seenRunningRuns: new Set(),
    announcedRuns: new Set(),
    firewallChecking: false,
    attackChecking: false
};


// SECURITY AUDIO

let securityAudioContext = null; // Shared audio context
let securityAudioEnabled = false; // Audio starts disabled
let lastAudioTime = 0; // Prevent excessive overlapping sounds

const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;


async function enableSecurityAudio() { // Enable audio after user interaction
    if (!AudioContextClass) {
        audioButton.textContent = "🔇 AUDIO UNSUPPORTED";
        audioButton.disabled = true;
        return;
    }

    try {
        if (!securityAudioContext || securityAudioContext.state === "closed") {
            securityAudioContext = new AudioContextClass();
        }

        if (securityAudioContext.state === "suspended") {
            await securityAudioContext.resume();
        }

        securityAudioEnabled = securityAudioContext.state === "running";

        if (securityAudioEnabled) {
            audioButton.textContent = "🔊 SECURITY AUDIO ON";
            audioButton.classList.add("enabled");
            playSecurityAlert("warning", true);
        } else {
            audioButton.textContent = "🔇 ENABLE SECURITY AUDIO";
        }

    } catch {
        securityAudioEnabled = false;
        audioButton.textContent = "🔇 AUDIO UNAVAILABLE";
    }
}


function playSecurityAlert(level, preview = false) { // Play warning or critical alarm
    if (!securityAudioEnabled || !securityAudioContext) return;
    if (securityAudioContext.state !== "running") return;

    const now = Date.now();

    if (!preview && now - lastAudioTime < 1500) return;

    lastAudioTime = now;

    const critical = level === "critical";
    const repetitions = critical ? 3 : 1;
    const duration = critical ? 0.32 : 0.2;
    const spacing = critical ? 0.45 : 0.26;

    for (let i = 0; i < repetitions; i++) {
        const oscillator = securityAudioContext.createOscillator();
        const gain = securityAudioContext.createGain();

        const start = securityAudioContext.currentTime + 0.02 + i * spacing;
        const end = start + duration;

        oscillator.type = critical ? "sawtooth" : "sine";

        oscillator.frequency.setValueAtTime(
            critical ? 840 : 630,
            start
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            critical ? 420 : 520,
            end
        );

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            critical ? 0.075 : 0.09,
            start + 0.025
        );

        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(securityAudioContext.destination);

        oscillator.start(start);
        oscillator.stop(end + 0.02);
    }
}


// INCIDENT MONITOR STYLING

const incidentStyles = document.createElement("style");

incidentStyles.textContent = `
    .incident-center {
        margin: 0 0 22px;
        padding: 22px;
        background: #252B32;
        border: 1px solid #46515A;
        border-radius: 12px;
        color: #F2F5F7;
        font-family: inherit;
    }

    .incident-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 14px;
    }

    .incident-heading h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
    }

    .incident-subtitle {
        margin: 5px 0 0;
        color: #9DAAB5;
        font-size: 0.78rem;
    }

    .incident-controls {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
    }

    .incident-indicator {
        font-size: 0.75rem;
        color: #9DAAB5;
    }

    .incident-audio-button {
        padding: 9px 13px;
        background: #1B2229;
        color: #30C4B5;
        border: 1px solid #30C4B5;
        border-radius: 7px;
        font: inherit;
        font-size: 0.72rem;
        font-weight: 800;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
    }

    .incident-audio-button:hover {
        background: #273A3B;
    }

    .incident-audio-button.enabled {
        color: #22C55E;
        border-color: #22C55E;
        background: #183329;
    }

    .incident-audio-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .incident-items {
        display: grid;
        gap: 10px;
    }

    .incident-empty {
        margin: 0;
        color: #9DAAB5;
        font-size: 0.84rem;
    }

    .incident-item {
        padding: 14px 16px;
        border: 1px solid #475059;
        border-left: 4px solid #30C4B5;
        background: #1B2229;
        border-radius: 8px;
        overflow-wrap: anywhere;
    }

    .incident-item.warning {
        border-left-color: #F59E0B;
    }

    .incident-item.critical {
        border-left-color: #EF4444;
        border-color: #EF4444;
        background: #342025;
    }

    .incident-item strong {
        display: block;
        margin-bottom: 6px;
        font-size: 0.88rem;
    }

    .incident-item p {
        margin: 0;
        color: #D5DDE3;
        font-size: 0.82rem;
        line-height: 1.7;
    }

    .incident-time {
        display: block;
        margin-top: 8px;
        font-size: 0.72rem;
        color: #9DAAB5;
    }

    .incident-toast-area {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 9999;
        width: min(460px, calc(100vw - 36px));
        pointer-events: none;
    }

    .incident-toast {
        padding: 17px 19px;
        margin-bottom: 10px;
        border: 1px solid #F59E0B;
        border-left: 5px solid #F59E0B;
        border-radius: 9px;
        background: #282521;
        color: #FFFFFF;
        box-shadow: 0 10px 36px #0008;
        pointer-events: auto;
    }

    .incident-toast.critical {
        background: #361D23;
        border-color: #EF4444;
        border-left: 5px solid #EF4444;
    }

    .incident-toast strong {
        display: block;
        margin-bottom: 8px;
        font-size: 0.9rem;
    }

    .incident-toast p {
        margin: 0;
        font-size: 0.82rem;
        line-height: 1.7;
    }

    .incident-toast button {
        margin-top: 12px;
        color: inherit;
        background: transparent;
        border: 1px solid currentColor;
        border-radius: 5px;
        padding: 5px 12px;
        font: inherit;
        font-size: 0.75rem;
        cursor: pointer;
    }

    @media (max-width: 600px) {
        .incident-center {
            padding: 16px;
        }

        .incident-heading {
            align-items: flex-start;
            flex-direction: column;
        }

        .incident-controls {
            width: 100%;
        }

        .incident-toast-area {
            top: 10px;
            right: 10px;
            width: calc(100vw - 20px);
        }
    }
`;

document.head.appendChild(incidentStyles);


// CREATE INCIDENT MONITOR

const incidentCenter = document.createElement("section");
incidentCenter.className = "incident-center";
incidentCenter.setAttribute(
    "aria-label",
    "Security Operations Center"
);

const incidentHeading = document.createElement("div");
incidentHeading.className = "incident-heading";

const incidentHeadingText = document.createElement("div");

const incidentTitle = document.createElement("h2");
incidentTitle.textContent = "🚨 Security Operations Center";

const incidentSubtitle = document.createElement("p");
incidentSubtitle.className = "incident-subtitle";
incidentSubtitle.textContent = "Active Threat Monitoring";

incidentHeadingText.append(incidentTitle, incidentSubtitle);


const incidentControls = document.createElement("div");
incidentControls.className = "incident-controls";

const incidentIndicator = document.createElement("span");
incidentIndicator.className = "incident-indicator";
incidentIndicator.textContent = "Connecting to security monitoring...";

const audioButton = document.createElement("button");
audioButton.type = "button";
audioButton.className = "incident-audio-button";
audioButton.textContent = "🔇 ENABLE SECURITY AUDIO";

audioButton.addEventListener("click", enableSecurityAudio);

incidentControls.append(incidentIndicator, audioButton);
incidentHeading.append(incidentHeadingText, incidentControls);


const incidentItems = document.createElement("div");
incidentItems.className = "incident-items";

const incidentEmpty = document.createElement("p");
incidentEmpty.className = "incident-empty";
incidentEmpty.textContent =
    "No new security incidents detected in this browser session.";

incidentItems.appendChild(incidentEmpty);

incidentCenter.append(incidentHeading, incidentItems);

const incidentAnchor =
    document.querySelector("main") ||
    document.querySelector(".dashboard-content");

if (incidentAnchor) {
    incidentAnchor.prepend(incidentCenter);
}


// FLOATING NOTIFICATIONS

const toastArea = document.createElement("div");
toastArea.className = "incident-toast-area";
toastArea.setAttribute("aria-live", "polite");

document.body.appendChild(toastArea);


function incidentEventKey(event) { // Identify a firewall event
    return [
        event.time,
        event.source_ip,
        event.destination_ip,
        event.protocol,
        event.port,
        event.decision
    ].join("|");
}


function pushIncident(level, title, message, timestamp = new Date()) { // Display incident and play sound
    if (incidentEmpty.isConnected) {
        incidentEmpty.remove();
    }

    playSecurityAlert(level); // Play audio only for newly announced incidents

    const card = document.createElement("article");
    card.className = `incident-item ${level}`;

    const heading = document.createElement("strong");
    heading.textContent = title;

    const details = document.createElement("p");
    details.textContent = message;

    const time = document.createElement("span");
    time.className = "incident-time";
    time.textContent = timestamp.toLocaleString();

    card.append(heading, details, time);
    incidentItems.prepend(card);

    while (incidentItems.children.length > 8) {
        incidentItems.lastElementChild.remove();
    }

    const toast = document.createElement("div");
    toast.className = `incident-toast ${level}`;

    const toastHeading = document.createElement("strong");
    toastHeading.textContent = title;

    const toastText = document.createElement("p");
    toastText.textContent = message;

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";

    dismiss.addEventListener("click", () => toast.remove());

    toast.append(toastHeading, toastText, dismiss);
    toastArea.prepend(toast);

    while (toastArea.children.length > 3) {
        toastArea.lastElementChild.remove();
    }

    setTimeout(() => {
        if (toast.isConnected) {
            toast.remove();
        }
    }, 12000);
}


// FIREWALL INCIDENT DETECTION

async function pollIncidentFirewall() { // Detect newly blocked attacker traffic
    if (incidentState.firewallChecking) return;

    incidentState.firewallChecking = true;

    try {
        const response = await fetch("/security-alerts", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Security alerts unavailable");
        }

        const data = await response.json();

        if (
            data.status !== "online" ||
            !Array.isArray(data.alerts)
        ) {
            throw new Error("Invalid firewall alert feed");
        }

        const relevant = data.alerts.filter(event =>
            event.source_ip === "192.168.10.3" &&
            ["DROP", "REJECT"].includes(event.decision)
        );

        const fresh = relevant.filter(event =>
            !incidentState.knownEvents.has(incidentEventKey(event))
        );

        relevant.forEach(event => {
            incidentState.knownEvents.add(incidentEventKey(event));
        });

        if (incidentState.knownEvents.size > 5000) {
            incidentState.knownEvents = new Set(
                Array.from(incidentState.knownEvents).slice(-2500)
            );
        }

        if (incidentState.firewallInitialized && fresh.length) {
            const latest = fresh[0];

            pushIncident(
                "warning",
                "⚠️ SUSPICIOUS NETWORK ACTIVITY DETECTED",
                `${fresh.length} new blocked packet event(s) detected. ` +
                `Source: ${latest.source_ip} | ` +
                `Target: ${latest.destination_ip} | ` +
                `Protocol: ${latest.protocol} | ` +
                `Port: ${latest.port} | ` +
                `Firewall Action: ${latest.decision}.`
            );
        }

        incidentState.firewallInitialized = true;

    } catch {
        incidentIndicator.textContent =
            "Firewall alert feed unavailable";

    } finally {
        incidentState.firewallChecking = false;
    }
}


// CRITICAL HR INCIDENT DETECTION

async function pollIncidentAttack() { // Detect confirmed HR access from a new experiment
    if (incidentState.attackChecking) return;

    incidentState.attackChecking = true;

    try {
        const response = await fetch("/attack-status", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Attack status unavailable");
        }

        const data = await response.json();
        const runId = data.run_id || null;

        incidentIndicator.textContent =
            "Monitoring firewall activity and HR access";

        if (!incidentState.attackInitialized) {
            incidentState.attackInitialized = true;
            incidentState.observedRunId = runId;

            if (data.status === "running" && runId) {
                incidentState.seenRunningRuns.add(runId);
            }

            return;
        }

        if (
            runId &&
            (
                incidentState.observedRunId !== runId ||
                data.status === "running"
            )
        ) {
            if (data.status === "running") {
                incidentState.seenRunningRuns.add(runId);
            }

            incidentState.observedRunId = runId;
        }

        const observedRunningRun =
            runId && incidentState.seenRunningRuns.has(runId);

        if (
            observedRunningRun &&
            data.status === "completed" &&
            data.hr_access_confirmed === true &&
            data.alert_level === "critical" &&
            !incidentState.announcedRuns.has(runId)
        ) {
            incidentState.announcedRuns.add(runId);

            pushIncident(
                "critical",
                "🚨 CRITICAL SECURITY ALERT — Unauthorized HR Data Access",
                `Severity: CRITICAL | ` +
                `Source: 192.168.10.3 | ` +
                `Target: ${data.target_ip || "192.168.20.10"} | ` +
                `Affected Service: HR Employee Records | ` +
                `Status: ACCESS CONFIRMED | ` +
                `Action Required: Investigate and restrict unauthorized access.`
            );
        }

    } catch {
        incidentIndicator.textContent =
            "Attack-status feed unavailable";

    } finally {
        incidentState.attackChecking = false;
    }
}


// DASHBOARD INITIALIZATION

function refreshCharts() { // Redraw charts after resizing
    drawTrafficChart();

    if (latestCounters) {
        drawDistributionChart(latestCounters);
    }
}


activateEmployeeService(
    companyButton,
    "company",
    "Company Information",
    "View Company"
);

activateEmployeeService(
    employeesButton,
    "employees",
    "Employee Directory",
    "View Employees"
);

activateEmployeeService(
    servicesButton,
    "services",
    "Service Availability",
    "Check Services"
);


window.addEventListener("resize", refreshCharts); // Keep charts responsive

checkServerStatus(); // Load server status
checkFirewallStatus(); // Load firewall statistics
refreshPacketEvents(); // Load packet events
refreshSecurityAlerts(); // Load existing security alerts

pollIncidentFirewall(); // Establish baseline for existing firewall events
pollIncidentAttack(); // Establish baseline for existing attack results

setInterval(checkServerStatus, REFRESH_INTERVAL); // Refresh server status
setInterval(checkFirewallStatus, REFRESH_INTERVAL); // Refresh firewall statistics
setInterval(refreshPacketEvents, REFRESH_INTERVAL); // Refresh packet events
setInterval(refreshSecurityAlerts, REFRESH_INTERVAL); // Refresh security alerts

setInterval(pollIncidentFirewall, REFRESH_INTERVAL); // Monitor new blocked traffic
setInterval(pollIncidentAttack, REFRESH_INTERVAL); // Monitor confirmed HR access

// NORMAL TRAFFIC SIMULATION

const normalTrafficButton = document.getElementById("send-normal-traffic-btn");
const normalTrafficCount = document.getElementById("normal-traffic-count");
const normalTrafficMessage = document.getElementById("normal-traffic-message");
const normalRequestsSent = document.getElementById("normal-requests-sent");
const normalRequestsSuccess = document.getElementById("normal-requests-success");
const normalRequestsFailed = document.getElementById("normal-requests-failed");
const normalTrafficResultsBody = document.getElementById("normal-traffic-results-body");

async function sendNormalTraffic() { // Send normal HTTP requests
    if (!normalTrafficButton || normalTrafficButton.disabled) return;

    const count = Number(normalTrafficCount.value);

    if (!Number.isInteger(count) || count < 1 || count > 20) {
        normalTrafficMessage.textContent = "Enter a number between 1 and 20.";
        normalTrafficMessage.style.color = colors.red;
        return;
    }

    normalTrafficButton.disabled = true;
    normalTrafficCount.disabled = true;
    normalTrafficButton.textContent = "● SENDING NORMAL TRAFFIC...";
    normalTrafficMessage.textContent = `Sending ${count} normal HTTP requests...`;
    normalTrafficMessage.style.color = colors.teal;

    try {
        const response = await fetch("/normal-traffic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count }),
            cache: "no-store"
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

        normalRequestsSent.textContent = data.requests_sent;
        normalRequestsSuccess.textContent = data.successful_responses;
        normalRequestsFailed.textContent = data.failed_requests;

        const rows = (data.results || []).map(record => {
            const row = document.createElement("tr");

            addEventCell(row, record.request);
            addEventCell(row, record.service);
            addEventCell(row, record.source);
            addEventCell(row, record.destination);
            addEventCell(row, record.port);
            addEventCell(row, record.http_status);

            const result = addEventCell(row, record.result);
            result.style.color = record.result === "SUCCESS" ? colors.green : colors.red;
            result.style.fontWeight = "700";

            return row;
        });

        if (normalTrafficResultsBody) {
            if (rows.length) {
                normalTrafficResultsBody.replaceChildren(...rows);
            } else {
                showMonitoringMessage(normalTrafficResultsBody, "No request records available.", 7);
            }
        }

        const successful = Number(data.successful_responses);
        const failed = Number(data.failed_requests);

        normalTrafficMessage.textContent =
            `Completed: ${successful} successful, ${failed} failed. Check Live Traffic Monitor for firewall decisions.`;
        normalTrafficMessage.style.color = failed === 0 ? colors.green : colors.red;

        await Promise.allSettled([
            checkFirewallStatus(),
            refreshPacketEvents()
        ]); // Update firewall statistics and events

    } catch (error) {
        normalTrafficMessage.textContent = `Normal traffic failed: ${error.message}`;
        normalTrafficMessage.style.color = colors.red;

    } finally {
        normalTrafficButton.disabled = false;
        normalTrafficCount.disabled = false;
        normalTrafficButton.textContent = "▶ SEND NORMAL TRAFFIC";
    }
}

if (normalTrafficButton) {
    normalTrafficButton.addEventListener("click", sendNormalTraffic);
}