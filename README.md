# Triple 4 Recruitment
## Adaptive Firewall Security Testing Using Machine Learning

### 1. Project Overview

Triple 4 Recruitment is a simulated recruitment company operating within a Docker-based network environment.

This project demonstrates how an attacker can use adaptive learning and network probing to investigate firewall behavior, identify accessible services, and discover security weaknesses.

The system includes a protected company server, a configurable firewall, an attacker environment, and a company security dashboard.

All companies, employee records, and attack scenarios are fictional and intended for educational security testing.

### 2. Project Objectives

The project aims to:

- Simulate a realistic network security environment using Docker.
- Implement firewall rules using Linux iptables.
- Generate legitimate and suspicious network traffic.
- Apply Epsilon-Greedy learning to adaptively select network probes.
- Analyze network responses using a Decision Tree classifier.
- Demonstrate the discovery of an intentionally exposed HR service.
- Monitor firewall decisions and network security events.
- Visualize security statistics and alerts through a web dashboard.

### 3. System Architecture

The environment consists of four Docker services.

| Component | Container | IP Address | Description |
|---|---|---|---|
| Firewall | lab-firewall | 192.168.10.2 / 192.168.20.2 | Controls and monitors network traffic |
| Company Server | lab-server | 192.168.20.10 | Hosts company and HR services |
| Attacker | lab-attacker | 192.168.10.3 | Performs network probing and adaptive learning |
| Company Dashboard | lab-dashboard | 192.168.10.4 | Displays network activity and security alerts |

The network uses two Docker subnets:

**External Network:** `192.168.10.0/24`

**Internal Network:** `192.168.20.0/24`

The firewall connects both networks and controls forwarded traffic.

### 4. Technologies Used

The project uses the following technologies:

- Docker and Docker Compose
- Python
- Flask
- Linux iptables
- NFLOG
- Scapy
- Scikit-learn
- Matplotlib
- HTML, CSS, and JavaScript

### 5. Machine Learning Components

#### 5.1 Epsilon-Greedy Multi-Armed Bandit

The attacker uses an Epsilon-Greedy algorithm to select network probing actions.

The algorithm balances exploration and exploitation.

**Exploration:** Selects a random probing action to investigate other possibilities.

**Exploitation:** Selects an action with the highest observed average reward.

The default exploration rate is:

`epsilon = 0.2`

This provides a 20% exploration probability and an 80% exploitation probability.

The algorithm updates its estimated action rewards using observed network responses.

The learning process is implemented in:

`attacker/learner.py`

The available probing actions are defined in:

`attacker/templates.py`

#### 5.2 Decision Tree Classification

A Decision Tree classifier analyzes recorded probing results to identify patterns associated with receiving network responses.

The model uses features such as:

- Network protocol
- Destination port
- Source address category
- Packet count
- TCP flags

The Decision Tree is implemented in:

`attacker/train_tree.py`

The model generates two output files:

`results/tree_rules.txt`

A text representation of the learned decision rules.

`results/tree.png`

A visual representation of the trained Decision Tree.

The Decision Tree predicts response patterns from observed data. It does not directly reconstruct the exact internal firewall configuration.

Decision Tree training is currently performed separately from the Full Attack workflow.

### 6. Firewall Security

The firewall uses iptables to manage network traffic.

Three principal firewall decisions are monitored.

| Decision | Description |
|---|---|
| ACCEPT | Permits matching network traffic |
| DROP | Blocks traffic without sending a rejection response |
| REJECT | Refuses traffic and sends a rejection response |

The firewall includes rules for:

- Established and related connections.
- Trusted internal network traffic.
- HTTP communication.
- TCP NULL and XMAS scan detection.
- Abnormal TCP connection attempts.
- ICMP rate limiting.
- Rejected SSH connections on port 22.
- Logging network events through NFLOG.

An intentionally exposed HR service is included to demonstrate security policy violations.

The environment also contains a DNAT rule redirecting TCP port 8081 to the HR service on port 9000.

These configurations form part of the controlled security testing scenario.

### 7. Web Interfaces

#### 7.1 Company Dashboard

**URL:** http://localhost:5000

The company dashboard provides:

- Firewall and server status.
- Packet statistics.
- Network traffic visualization.
- Traffic distribution.
- Live traffic monitoring.
- Security alerts.
- Security Operations Center.
- Employee services.
- Normal traffic simulation.

The dashboard monitors firewall activity and reports suspicious network events.

#### 7.2 Attacker Dashboard

**URL:** http://localhost:5001

The attacker dashboard provides an interface for running and monitoring the learning experiment and Full Attack simulation.

The interface supports:

**START LEARNING**

Starts an adaptive network probing experiment using the selected learning configuration.

**FULL ATTACK**

Runs a complete simulated attack consisting of adaptive probing, open-port discovery, service investigation, and HR access verification.

Experiment progress and results are displayed through the attacker interface.

### 8. System Requirements

Before running the project, ensure that the following are available:

- Windows, Linux, or macOS.
- Docker Desktop or a compatible Docker Engine.
- Docker Compose.
- An internet connection for downloading the required Docker images and dependencies.
- A web browser.

On Windows, Docker Desktop should be configured to run Linux containers.

Python dependencies are installed automatically inside the Docker images.

### 9. Installation and Setup

#### Step 1: Extract the Project

Extract the project folder to a suitable location on the computer.

#### Step 2: Open the Project Directory

Open PowerShell or a terminal inside the folder containing:

`docker-compose.yml`

#### Step 3: Build and Start the Containers

Run:

```powershell
docker compose up -d --build
```

Docker Compose builds and starts the four services.

#### Step 4: Verify Container Status

Run:

```powershell
docker compose ps
```

Confirm that these containers are running:

- lab-firewall
- lab-server
- lab-attacker
- lab-dashboard

#### Step 5: Open the Interfaces

Company Dashboard:

http://localhost:5000

Attacker Dashboard:

http://localhost:5001

### 10. Running the Simulation

#### Scenario 1: Normal Network Traffic

1. Open the Company Dashboard.
2. Navigate to **Normal Traffic Simulation**.
3. Select the number of requests.
4. Click **SEND NORMAL TRAFFIC**.
5. Review the HTTP response results.
6. Observe the corresponding network activity in the firewall monitoring sections.

The simulation generates legitimate HTTP requests to company services.

HTTP response codes and firewall decisions are recorded separately.

#### Scenario 2: Adaptive Learning

1. Open the Attacker Dashboard.
2. Configure the available learning settings.
3. Click **START LEARNING**.
4. Monitor the experiment progress.
5. Review the recorded probes and their responses.

The attacker uses Epsilon-Greedy learning to select probing actions based on observed rewards.

#### Scenario 3: Full Attack Simulation

1. Open the Attacker Dashboard.
2. Click **FULL ATTACK**.
3. Monitor the learning and probing process.
4. Review the discovered ports.
5. Observe the service investigation results.
6. Check whether HR access was confirmed.
7. Open the Company Dashboard to review firewall activity and security alerts.

The Full Attack uses 400 probing steps.

Successful HR access is reported when the application's verification conditions are satisfied.

The scenario is performed using fictional employee information in the isolated Docker environment.

### 11. Decision Tree Analysis

To train the Decision Tree manually, run:

```powershell
docker exec lab-attacker python3 /lab/train_tree.py
```

The script reads:

`results/probes.jsonl`

It then generates:

- `results/tree_rules.txt`
- `results/tree.png`

**Important:** The current script uses `probes.jsonl` as its training dataset. It does not automatically train on the latest experiment launched through the web interface.

### 12. Experimental Results

The project stores experiment outputs in the `results` directory.

| File | Description |
|---|---|
| attack_*.json | Full Attack findings |
| learning_*.jsonl | Individual probing records |
| learning_*.log | Experiment execution logs |
| probes.jsonl | Dataset used by the current Decision Tree training script |
| tree.png | Decision Tree visualization |
| tree_rules.txt | Extracted Decision Tree rules |
| hr_access.log | HR access activity log |

The supplied results include a completed Full Attack experiment in which the attacker discovered ports 80, 8081, and 9000 and recorded confirmed HR access.

These results represent the tested simulation environment. Results may differ when the experiment is executed under different configurations.

### 13. Monitoring and Security Alerts

The Company Dashboard displays firewall events collected through NFLOG.

The monitoring system records:

- Source IP address.
- Destination IP address.
- Protocol.
- Destination port.
- Firewall decision.
- Event timestamp.

The Security Operations Center displays alerts when suspicious network activity is detected.

Firewall decisions and application-level HTTP outcomes are interpreted separately.

### 14. Stopping the Project

To stop and remove the project's containers and Compose networks, run:

```powershell
docker compose down
```

To start the environment again, run:

```powershell
docker compose up -d
```

Experiment files stored in the host-mounted `results` directory remain available after the containers are stopped.

### 15. Troubleshooting

**Containers do not start**

Check Docker Desktop and verify that Docker is running.

Review the container status:

```powershell
docker compose ps
```

**A service reports an error**

View its logs:

```powershell
docker compose logs --tail=100
```

**The dashboard is unavailable**

Verify that the dashboard container is running and that port 5000 is not occupied by another application.

**The attacker interface is unavailable**

Verify that the attacker container is running and that port 5001 is available.

**Network communication fails**

Check the container status and verify that the firewall service is running.

Rebuild the environment if necessary:

```powershell
docker compose up -d --build
```

### 16. Project Limitations

The environment is designed for educational experiments rather than production deployment.

The firewall rules are configured for a specific simulated network topology.

The learning algorithm uses observable network responses as rewards.

A received TCP response does not always indicate successful access to a service, particularly when firewall rejection rules return TCP resets.

The Decision Tree analyzes response patterns rather than identifying exact firewall rules.

The current Decision Tree training workflow is separate from the Full Attack interface.

### 17. Ethical and Security Considerations

This project must only be executed in an authorized testing environment.

All organization names, employee records, and HR information are fictional.

The intentionally exposed HR service exists solely to demonstrate security weaknesses in a controlled laboratory.

The project must not be used to test or access networks without authorization.

---

**Project:** Adaptive Firewall Security Testing Using Machine Learning  
**Simulated Organization:** Triple 4 Recruitment  
**Attacker Organization:** Prime HR Consulting  
**Environment:** Docker-Based Cybersecurity Laboratory