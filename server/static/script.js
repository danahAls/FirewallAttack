// Get the server status element from the HTML page.
const serverStatus = document.getElementById("server-status");

// Get the status indicator from the HTML page.
const statusDot = document.getElementById("status-dot");

// Check whether the Flask server is responding.
async function checkServerStatus() {
    try {
        // Request the server's current health status.
        const response = await fetch("/health");

        // Stop if the server returns an unsuccessful response.
        if (!response.ok) {
            throw new Error("Server health check failed");
        }

        // Read the response returned by Flask.
        const data = await response.json();

        // Check whether the server reports an online status.
        const isOnline = data.status === "online";

        // Display the server's actual response.
        serverStatus.textContent = isOnline ? "Online" : "Unknown";

        // Activate the green indicator only when the server is online.
        statusDot.classList.toggle("online", isOnline);

    } catch (error) {
        // Display an error state if the request fails.
        serverStatus.textContent = "Offline";

        // Remove the green indicator when the server is unavailable.
        statusDot.classList.remove("online");
    }
}

// Check the server when the dashboard opens.
checkServerStatus();

// Repeat the health check every two seconds.
setInterval(checkServerStatus, 2000);