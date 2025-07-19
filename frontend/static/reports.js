// frontend/static/reports.js

document.addEventListener('DOMContentLoaded', function() {
    const threatReportsContainer = document.getElementById('threatReportsContainer');

    // Modal elements (reused from threat-detection.js logic)
    const incidentDetailsModal = document.getElementById('incidentDetailsModal');
    const modalIncidentId = document.getElementById('modalIncidentId');
    const modalContent = document.getElementById('modalContent');

    function getSeverityClass(threatLabel) {
        threatLabel = String(threatLabel).toLowerCase(); // Ensure it's a string and lowercase for robust comparison
        if (threatLabel.includes('ddos') ||
            threatLabel.includes('infiltration') ||
            threatLabel.includes('bot') ||
            threatLabel.includes('dos goldeneye') || // NEW
            threatLabel.includes('dos hulk') ||     // NEW
            threatLabel.includes('dos slowloris')) { // NEW
            return { className: 'High', text: 'High' };
        } else if (threatLabel.includes('portscan') ||
                   threatLabel.includes('brute force') ||
                   threatLabel.includes('xss') ||
                   threatLabel.includes('sql injection') ||
                   threatLabel.includes('ftp patator')) { // NEW
            return { className: 'Moderate', text: 'Moderate' };
        } else if (threatLabel.includes('benign')) {
            return { className: 'Low', text: 'Low' };
        } else {
            return { className: 'Unknown', text: 'Unknown' };
        }
    }

    // Function to display classified threats as cards
    async function fetchAndDisplayThreatReports() {
        threatReportsContainer.innerHTML = '<p>Loading threat reports...</p>';
        try {
            const response = await fetch('/api/threat_reports');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const reports = await response.json();

            threatReportsContainer.innerHTML = ''; // Clear loading message

            if (!reports || reports.length === 0) {
                threatReportsContainer.innerHTML = '<p>No saved threat reports found.</p>';
                return;
            }

            reports.forEach(report => {
                const card = document.createElement('div');
                card.classList.add('incident-card');

                // Get severity class and text
                const severity = getSeverityClass(report.predicted_threat_label);

                // Extract date and time for card display from the stored timestamp
                let displayDate = 'N/A';
                let displayTime = 'N/A';
                if (report.timestamp) {
                    try {
                        const ts = new Date(report.timestamp);
                        displayDate = ts.toLocaleDateString();
                        displayTime = ts.toLocaleTimeString();
                    } catch (e) { /* Fallback to N/A */ }
                }

                // The card content: now uses "Type of Attack" label and Threat Label as content
                card.innerHTML = `
                    <div class="card-header-custom">
                        <h4>Incident ID: #${report.incident_id_display}</h4>
                        <span class="threat-level-badge ${severity.className}">${severity.text}</span>
                    </div>
                    <div class="incident-card-body">
                        <h5>${report.predicted_threat_label || 'Unknown Attack'}</h5>
                        <p><strong>Type of Attack:</strong> ${report.predicted_threat_label || 'N/A'}</p>
                        <p>Date: ${displayDate}</p>
                        <p>Time: ${displayTime}</p>
                        <p>Source File: ${report.source_filename || 'N/A'}</p>
                    </div>
                `;

                // Store the full incident data (from full_details) on the card element for later use in modal
                card.dataset.fullIncident = JSON.stringify(report.full_details);
                card.dataset.incidentIdDisplay = report.incident_id_display; // Store for modal title

                card.addEventListener('click', function() {
                    const fullIncidentDetails = JSON.parse(this.dataset.fullIncident);
                    const incidentIdFromCard = this.dataset.incidentIdDisplay;
                    showIncidentDetails(fullIncidentDetails, incidentIdFromCard, report.predicted_threat_label);
                });
                threatReportsContainer.appendChild(card);
            });

        } catch (error) {
            console.error('Error fetching threat reports:', error);
            threatReportsContainer.innerHTML = `<p style="color: red;">Error loading threat reports: ${error.message}</p>`;
        }
    }

    // Function to show incident details in a modal
function showIncidentDetails(incidentDetails, incidentIdForModal, predictedThreatLabel) {
    // Get the elements needed for the modal
    const modalContent = document.getElementById('modalContent');
    const modalIncidentId = document.getElementById('modalIncidentId');
    const incidentDetailsModal = document.getElementById('incidentDetailsModal');
    
    // Get the report generation button from the modal's header
    const generateReportBtn = document.getElementById('generateReportBtn');

    modalIncidentId.textContent = `#${incidentIdForModal}`;

    // Store the original HTML content to restore it later
    let originalDetailsHtml = '';
    const severity = getSeverityClass(predictedThreatLabel);

    originalDetailsHtml += `<p><strong>Predicted Threat:</strong> <span class="threat-level-badge ${severity.className}" style="display: inline-block; padding: 3px 8px; font-size: 0.9em; position: unset;">${severity.text}</span></p>`;

    // Display the full message or a default if not available
    const fullMessage = incidentDetails.Message || (incidentDetails.action && incidentDetails.action.includes("Threat Detected:") ? incidentDetails.action.replace("Threat Detected: ", "") : 'No detailed message available.');
    originalDetailsHtml += `<p><strong>Type of Attack:</strong> ${predictedThreatLabel || 'N/A'}</p>`;
    originalDetailsHtml += `<p><strong>Details:</strong> ${fullMessage}</p>`;

    // Extract date and time for consistency in modal
    let detailDate = 'N/A';
    let detailTime = 'N/A';
    if (incidentDetails['Timestamp']) {
        try {
            const ts = new Date(incidentDetails['Timestamp']);
            detailDate = ts.toLocaleDateString();
            detailTime = ts.toLocaleTimeString();
        } catch (e) { /* continue with N/A */ }
    } else if (incidentDetails['Flow Start']){
        try {
            const ts = new Date(incidentDetails['Flow Start']);
            detailDate = ts.toLocaleDateString();
            detailTime = ts.toLocaleTimeString();
        } catch (e) { /* continue with N/A */ }
    } else if (incidentDetails.timestamp) { // Fallback to the database timestamp
        try {
            const ts = new Date(incidentDetails.timestamp);
            detailDate = ts.toLocaleDateString();
            detailTime = ts.toLocaleTimeString();
        } catch (e) { /* continue with N/A */ }
    } else {
        const now = new Date();
        detailDate = now.toLocaleDateString();
        detailTime = now.toLocaleTimeString();
    }
    originalDetailsHtml += `<p><strong>Date:</strong> ${detailDate}</p>`;
    originalDetailsHtml += `<p><strong>Time:</strong> ${detailTime}</p>`;

    originalDetailsHtml += '<hr>';
    originalDetailsHtml += '<h4>Key Network Flow Indicators:</h4>';

    // Define a preferred order for common network indicators to show first
    const orderedKeys = [
        'Source IP', 'Destination IP', 'Source Port', 'Destination Port',
        'Protocol', 'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
        'Flow Bytes/s', 'Flow Packets/s', 'Fwd Packet Length Mean', 'Bwd Packet Length Mean',
        'Min Packet Length', 'Max Packet Length', 'Fwd PSH Flags', 'SYN Flag Count', 'RST Flag Count',
        'ACK Flag Count', 'URG Flag Count', 'Down/Up Ratio', 'Idle Mean', 'Active Mean'
    ];

    // Add ordered keys first
    orderedKeys.forEach(key => {
        if (incidentDetails.hasOwnProperty(key)) {
            let value = incidentDetails[key];
            if (value === null || value === undefined || value === '') {
                value = 'N/A';
            } else if (typeof value === 'number') {
                value = value.toFixed(2);
            }
            originalDetailsHtml += `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`;
        }
    });

    // Add all other keys not in the preferred order
    for (const key in incidentDetails) {
        if (incidentDetails.hasOwnProperty(key) &&
            !orderedKeys.includes(key) &&
            key !== 'Predicted_Threat_Label' &&
            key !== 'Message' &&
            key !== 'action' &&
            key !== 'timestamp' &&
            key !== 'Flow Start' &&
            key !== 'Timestamp' &&
            key !== 'id' &&
            key !== 'Incident ID' &&
            key !== 'Flow ID' &&
            key !== 'ID'
        ) {
            let value = incidentDetails[key];
            if (value === null || value === undefined || value === '') {
                value = 'N/A';
            } else if (typeof value === 'number') {
                value = value.toFixed(2);
            }
            originalDetailsHtml += `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`;
        }
    }

    // Set the initial content of the modal
    modalContent.innerHTML = originalDetailsHtml;
    incidentDetailsModal.style.display = 'block';

    // Remove any previous event listeners on the button to prevent duplicates
    const newBtn = generateReportBtn.cloneNode(true);
    generateReportBtn.parentNode.replaceChild(newBtn, generateReportBtn);

    // Add the new click event listener
    newBtn.addEventListener('click', async () => {
        // Show a loading message in the modal
        modalContent.innerHTML = '<p>Generating AI report... please wait.</p>';

        try {
            const response = await fetch('/api/generate_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    incident_id: incidentIdForModal,
                    threat_type: predictedThreatLabel,
                    // Pass the full details object for a richer report
                    details: incidentDetails
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Display the generated report content in the modal
            modalContent.innerHTML = `<h3>Generated AI Report</h3>`;
            modalContent.innerHTML += `<div class="w3-card-4 w3-padding" style="white-space: pre-wrap;">${result.report}</div>`;
            
        } catch (error) {
            console.error('Error:', error);
            modalContent.innerHTML = `<p style="color: red;">Failed to generate report. Please try again.</p>`;
        }
    });
}

    // Fetch and display reports when the page loads
    fetchAndDisplayThreatReports();
});