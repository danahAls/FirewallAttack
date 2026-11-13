const serverStatus = document.getElementById("server-status"); // Server status text
const statusDot = document.getElementById("status-dot"); // Server status indicator

const companyButton = document.getElementById("company-info-btn"); // Company information button
const employeesButton = document.getElementById("employee-directory-btn"); // Employee directory button
const servicesButton = document.getElementById("service-check-btn"); // Service availability button

function createResultPanel() { // Create a section for service responses
    const servicesSection = document.getElementById("employee-services");
    const panel = document.createElement("div");

    panel.id = "service-result";
    panel.style.cssText = "display:none;margin-top:20px;padding:22px;background:#1C2229;border:1px solid #37434B;border-radius:12px;";

    servicesSection.appendChild(panel);

    return panel;
}

const resultPanel = createResultPanel(); // Prepare the service results area

function displayResult(title, content, error = false) { // Display actual service responses
    resultPanel.replaceChildren();
    resultPanel.style.display = "block";
    resultPanel.style.borderColor = error ? "#EF4444" : "#37434B";

    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = "color:#30C4B5;margin-bottom:15px;font-size:1rem;";

    const output = document.createElement("pre");
    output.textContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    output.style.cssText = "color:#E8EDF1;font-family:Consolas,monospace;font-size:0.85rem;white-space:pre-wrap;overflow-wrap:anywhere;";

    resultPanel.append(heading, output);
}

async function checkServerStatus() { // Check protected server availability
    try {
        const response = await fetch("/health", { cache: "no-store" });

        if (!response.ok) {
            throw new Error("Server health check failed");
        }

        const data = await response.json();
        const isOnline = data.status === "ok" || data.status === "online";

        serverStatus.textContent = isOnline ? "Online" : "Unknown";
        statusDot.classList.toggle("online", isOnline);

    } catch (error) {
        serverStatus.textContent = "Offline";
        statusDot.classList.remove("online");
    }
}

async function requestService(endpoint, title, button) { // Send a real HTTP request to Flask
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Loading...";

    try {
        const response = await fetch(endpoint, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        displayResult(title, data);

    } catch (error) {
        displayResult(title, `Request failed: ${error.message}`, true);

    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function activateService(button, endpoint, title, label) { // Connect a button to its Flask endpoint
    if (!button) {
        return;
    }

    button.disabled = false;
    button.textContent = label;

    button.addEventListener("click", () => {
        requestService(endpoint, title, button);
    });
}

activateService(companyButton, "/api/company", "Company Information", "View Company"); // Enable company information
activateService(employeesButton, "/api/employees", "Employee Directory", "View Employees"); // Enable employee directory
activateService(servicesButton, "/api/services", "Service Availability", "Check Services"); // Enable service information

checkServerStatus(); // Check server when the portal opens
setInterval(checkServerStatus, 2000); // Refresh server status every two seconds