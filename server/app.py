from flask import Flask, jsonify, render_template

app = Flask(__name__)

COMPANY = { # Fictional recruitment company
    "name": "TRIPLE 4 RECRUITMENT",
    "industry": "Recruitment and Staffing",
    "slogan": "Connecting Talent with Opportunity.",
    "location": "Riyadh, Saudi Arabia",
    "status": "Active"
}

EMPLOYEES = [ # Fictional employee directory
    {"id": "EMP001", "name": "Danah", "department": "Engineering", "role": "Engineer"},
    {"id": "EMP002", "name": "Yara", "department": "Management & HR", "role": "Manager & HR"},
    {"id": "EMP003", "name": "Layan", "department": "Cybersecurity", "role": "Top tier hacker"},
    {"id": "EMP004", "name": "Hala", "department": "Art", "role": "Artist"},
    {"id": "EMP005", "name": "Tala", "department": "Design", "role": "Designer"}
]

@app.route("/")
def index(): # Display the company employee portal
    return render_template("index.html")

@app.route("/health")
def health(): # Preserve the original server health response
    return jsonify(status="ok")

@app.route("/api/company")
def company_info(): # Return company information
    return jsonify(COMPANY)

@app.route("/api/employees")
def employee_directory(): # Return fictional employee records
    return jsonify(employees=EMPLOYEES, total=len(EMPLOYEES))

@app.route("/api/services")
def company_services(): # Return available company services
    return jsonify(
        company_portal="available",
        employee_directory="available",
        health_endpoint="/health"
    )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)