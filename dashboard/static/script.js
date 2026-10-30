// Get the server status element from the HTML page.
const serverStatus = document.getElementById("server-status");

// Get the firewall status and packet counter elements.
const firewallStatus = document.getElementById("firewall-status");
const totalPackets = document.getElementById("total-packets");
const acceptedPackets = document.getElementById("accepted-packets");
const droppedPackets = document.getElementById("dropped-packets");

// Get the counter for packets rejected by firewall rules.
const rejectedPackets = document.getElementById("rejected-packets");

// Check whether the protected server is responding.
async function checkServerStatus() {
    try {
        // Request the protected server's status through the dashboard backend.
        const response = await fetch("/server-status");

        // Stop if the dashboard returns an unsuccessful response.
        if (!response.ok) {
            throw new Error("Server health check failed");
        }

        // Read the response returned by Flask.
        const data = await response.json();

        // Display the protected server's actual status.
        serverStatus.textContent = data.status === "online" ? "Online" : "Offline";

    } catch (error) {
        // Display an offline state if the request fails.
        serverStatus.textContent = "Offline";
    }
}

// Retrieve real packet statistics from the firewall monitoring API.
async function checkFirewallStatus() {
    try {
        // Request firewall statistics through the dashboard backend.
        const response = await fetch("/firewall-stats");

        // Stop if the monitoring API is unavailable.
        if (!response.ok) {
            throw new Error("Firewall monitoring request failed");
        }

        // Read the firewall statistics returned by Flask.
        const data = await response.json();

        // Display the firewall monitoring status.
        firewallStatus.textContent = data.status === "online" ? "Online" : "Offline";

        // Display real packet counters from iptables.
        totalPackets.textContent = data.total;
        acceptedPackets.textContent = data.accepted;
        droppedPackets.textContent = data.dropped;

        // Display the real number of rejected packets.
        rejectedPackets.textContent = data.rejected;

    } catch (error) {
        // Avoid displaying outdated counters when monitoring is unavailable.
        firewallStatus.textContent = "Offline";
        totalPackets.textContent = "Unavailable";
        acceptedPackets.textContent = "Unavailable";
        droppedPackets.textContent = "Unavailable";

        // Avoid showing outdated rejected-packet statistics.
        rejectedPackets.textContent = "Unavailable";
    }
}

// Check the server when the dashboard opens.
checkServerStatus();

// Check the firewall when the dashboard opens.
checkFirewallStatus();

// Repeat the health check every two seconds.
setInterval(checkServerStatus, 2000);

// Refresh firewall statistics every two seconds.
setInterval(checkFirewallStatus, 2000);