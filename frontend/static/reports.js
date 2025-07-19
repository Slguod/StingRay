// frontend/static/reports.js

document.addEventListener('DOMContentLoaded', function() {
    const threatReportsContainer = document.getElementById('threatReportsContainer');
    // NEW: Filter elements
    const threatTypeFilter = document.getElementById('threatTypeFilter');
    const attackTypeFilter = document.getElementById('attackTypeFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    let allThreatReports = []; // To store all fetched reports for filtering

    // Modal elements (reused from threat-detection.js logic)
    const incidentDetailsModal = document.getElementById('incidentDetailsModal');
    const modalIncidentId = document.getElementById('modalIncidentId');
    const modalContent = document.getElementById('modalContent');
    // NEW: Reference to the generate report button in the modal
    const generateReportBtn = document.getElementById('generateReportBtn');


    // Function to determine severity class and text based on threat label
    function getSeverityClass(threatLabel) {
        threatLabel = String(threatLabel).toLowerCase(); // Ensure it's a string and lowercase for robust comparison
        if (threatLabel.includes('ddos') ||
            threatLabel.includes('infiltration') ||
            threatLabel.includes('bot') ||
            threatLabel.includes('web attack') || // Added 'web attack' for completeness as it might be a general label
            threatLabel.includes('dos goldeneye') ||
            threatLabel.includes('dos hulk') ||
            threatLabel.includes('dos slowloris')) {
            return { className: 'High', text: 'High' };
        } else if (threatLabel.includes('portscan') ||
                   threatLabel.includes('brute force') ||
                   threatLabel.includes('xss') ||
                   threatLabel.includes('sql injection') ||
                   threatLabel.includes('ftp patator')) {
            return { className: 'Moderate', text: 'Moderate' };
        } else if (threatLabel.includes('benign')) {
            return { className: 'Low', text: 'Low' };
        } else {
            return { className: 'Unknown', text: 'Unknown' };
        }
    }

    // NEW: Function to populate the Attack Type filter dropdown
    function populateAttackTypeFilter(reports) {
        const attackTypes = new Set();
        reports.forEach(report => {
            if (report.predicted_threat_label) {
                attackTypes.add(report.predicted_threat_label);
            }
        });

        // Clear previous options except "All"
        attackTypeFilter.innerHTML = '<option value="All">All Attack Types</option>';
        Array.from(attackTypes).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            attackTypeFilter.appendChild(option);
        });
    }

    // NEW: Function to apply filters and display reports
    function applyFilters() {
        const selectedThreatType = threatTypeFilter.value;
        const selectedAttackType = attackTypeFilter.value;

        threatReportsContainer.innerHTML = ''; // Clear current display

        if (allThreatReports.length === 0) {
            threatReportsContainer.innerHTML = '<p>No saved threat reports found.</p>';
            return;
        }

        const filteredReports = allThreatReports.filter(report => {
            const severity = getSeverityClass(report.predicted_threat_label).text;
            const attackType = report.predicted_threat_label;

            const matchesThreatType = selectedThreatType === 'All' || severity === selectedThreatType;
            const matchesAttackType = selectedAttackType === 'All' || attackType === selectedAttackType;

            return matchesThreatType && matchesAttackType;
        });

        if (filteredReports.length === 0) {
            threatReportsContainer.innerHTML = '<p>No reports match the selected filters.</p>';
            return;
        }

        filteredReports.forEach(report => {
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

            // The card content
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
            card.dataset.predictedThreatLabel = report.predicted_threat_label; // Store for modal

            card.addEventListener('click', function() {
                const fullIncidentDetails = JSON.parse(this.dataset.fullIncident);
                const incidentIdFromCard = this.dataset.incidentIdDisplay;
                const predictedThreatLabelFromCard = this.dataset.predictedThreatLabel;
                showIncidentDetails(fullIncidentDetails, incidentIdFromCard, predictedThreatLabelFromCard);
            });
            threatReportsContainer.appendChild(card);
        });
    }

    // MODIFIED: Function to fetch and display classified threats as cards
    async function fetchAndDisplayThreatReports() {
        threatReportsContainer.innerHTML = '<p>Loading threat reports...</p>';
        try {
            const response = await fetch('/api/threat_reports');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const reports = await response.json();

            allThreatReports = reports; // Store all reports

            // Populate filter dropdowns
            populateAttackTypeFilter(allThreatReports);

            // Apply filters to display initial set (which will be all if filters are at "All")
            applyFilters();

        

        } catch (error) {
            console.error('Error fetching threat reports:', error);
            threatReportsContainer.innerHTML = `<p style="color: red;">Error loading threat reports: ${error.message}</p>`;
        }
    }

    // Function to show incident details in a modal (AI Report Generation Included)
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
        modalIncidentId.textContent = `#${incidentIdForModal}`;
        modalContent.innerHTML = originalDetailsHtml; // Display initial details
        incidentDetailsModal.style.display = 'block';

        // Remove any previous event listeners on the button to prevent duplicates
        // Clone and replace the button to remove old event listeners
        const oldBtn = generateReportBtn;
        const newBtn = oldBtn.cloneNode(true); // Create a new button node from the old one
        oldBtn.parentNode.replaceChild(newBtn, oldBtn); // Replace the old button with the new one

        // Add the new click event listener to the NEW button
        newBtn.addEventListener('click', async () => {
            // Store current modal content to restore after AI report generation
            const currentModalContent = modalContent.innerHTML;
            modalContent.innerHTML = '<p>Generating AI report... please wait.</p>'; // Show loading message

            try {
                const response = await fetch('/api/generate_report', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        incident_id: incidentIdForModal,
                        threat_type: predictedThreatLabel,
                        details: incidentDetails // Pass the full details object for a richer report
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

    // Event Listeners for filters
    threatTypeFilter.addEventListener('change', applyFilters);
    attackTypeFilter.addEventListener('change', applyFilters);
    clearFiltersBtn.addEventListener('click', function() {
        threatTypeFilter.value = 'All';
        attackTypeFilter.value = 'All';
        applyFilters(); // Apply filters to reset to all
    });

    // Initial fetch and display of reports when the page loads
    fetchAndDisplayThreatReports();
});