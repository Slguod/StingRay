document.addEventListener('DOMContentLoaded', function() {
    const uploadedFilesDropdown = document.getElementById('uploadedFilesDropdown');
    const classifySelectedFileBtn = document.getElementById('classifySelectedFileBtn');
    const classificationMessage = document.getElementById('classificationMessage');
    const newClassificationFile = document.getElementById('newClassificationFile');
    const classifyNewFileBtn = document.getElementById('classifyNewFileBtn');
    const newClassificationMessage = document.getElementById('newClassificationMessage');
    const resultsCardsContainer = document.getElementById('resultsCardsContainer');

    // Modal elements
    const incidentDetailsModal = document.getElementById('incidentDetailsModal');
    const modalIncidentId = document.getElementById('modalIncidentId');
    const modalContent = document.getElementById('modalContent');

    // Function to fetch and populate the dropdown with uploaded files
    async function fetchUploadedFiles() {
        try {
            const response = await fetch('/api/uploaded_files');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const files = await response.json();

            uploadedFilesDropdown.innerHTML = '<option value="">-- Select a file --</option>'; // Clear existing options
            if (files.length > 0) {
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    option.textContent = file;
                    uploadedFilesDropdown.appendChild(option);
                });
                classifySelectedFileBtn.disabled = false; // Enable button if files exist
            } else {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No files uploaded yet.";
                uploadedFilesDropdown.appendChild(option);
                classifySelectedFileBtn.disabled = true; // Disable button if no files
            }
        } catch (error) {
            console.error('Error fetching uploaded files:', error);
            classificationMessage.textContent = 'Error loading file list.';
            classificationMessage.style.color = 'red';
        }
    }

    // Function to determine severity class and text based on threat label
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

    function generateIncidentId() {
        return Math.floor(100000 + Math.random() * 900000);
    }
    // Function to display classification results as cards
    function displayResults(data) {
        resultsCardsContainer.innerHTML = ''; // Clear previous results

        if (!data || data.length === 0) {
            resultsCardsContainer.innerHTML = '<p>No threats detected.</p>';
            return;
        }

        data.forEach((incident, index) => {
            const card = document.createElement('div');
            card.classList.add('incident-card');

            // Get severity class and text
            const severity = getSeverityClass(incident.Predicted_Threat_Label);

            // Generate incident ID
            const incidentId = generateIncidentId();

            // Extract date and time for card display, prioritizing 'Timestamp' or 'Flow Start'
            let displayDate = 'N/A';
            let displayTime = 'N/A';
            if (incident['Timestamp']) {
                try {
                    const ts = new Date(incident['Timestamp']);
                    displayDate = ts.toLocaleDateString();
                    displayTime = ts.toLocaleTimeString();
                } catch (e) { /* Fallback to N/A */ }
            } else if (incident['Flow Start']){
                 try {
                     const ts = new Date(incident['Flow Start']);
                     displayDate = ts.toLocaleDateString();
                     displayTime = ts.toLocaleTimeString();
                 } catch (e) { /* Fallback to N/A */ }
            } else { // Fallback to current classification time if no relevant timestamp found
                const now = new Date();
                displayDate = now.toLocaleDateString();
                displayTime = now.toLocaleTimeString();
            }

            // The card content with header, ID, and color-coded badge
            card.innerHTML = `
                <div class="card-header-custom">
                    <h4>Incident ID: #${incidentId}</h4>
                    <span class="threat-level-badge ${severity.className}">${severity.text}</span>
                </div>
                <div class="incident-card-body">
                    <h5>${incident.Predicted_Threat_Label || 'Unknown Attack'}</h5>
                    <p><strong>Type of Attack:</strong> ${incident.Predicted_Threat_Label || 'N/A'}</p>
                    <p>Date: ${displayDate}</p>
                    <p>Time: ${displayTime}</p>
                </div>
            `;

            // Store the full incident data on the card element for later use in modal
            card.dataset.fullIncident = JSON.stringify(incident);

            card.addEventListener('click', function() {
                const fullIncident = JSON.parse(this.dataset.fullIncident);
                showIncidentDetails(fullIncident, incidentId); // Pass incidentId to modal
            });
            resultsCardsContainer.appendChild(card);
        });
    }

    // Function to show incident details in a modal
    function showIncidentDetails(incident, cardIncidentId) { // Receive incidentId from card
        // Use the same incident ID that was displayed on the card
        modalIncidentId.textContent = `#${cardIncidentId}`;

        let detailsHtml = '';
        const severity = getSeverityClass(incident.Predicted_Threat_Label);

        detailsHtml += `<p><strong>Predicted Threat:</strong> <span class="threat-level-badge ${severity.className}" style="display: inline-block; padding: 3px 8px; font-size: 0.9em; position: unset;">${severity.text}</span></p>`;

        // Display the full message or a default if not available
        const fullMessage = incident.Message || (incident.action && incident.action.includes("Threat Detected:") ? incident.action.replace("Threat Detected: ", "") : 'No detailed message available.');
        detailsHtml += `<p><strong>Type of Attack:</strong> ${incident.Predicted_Threat_Label || 'N/A'}</p>`; // Consistent label
        detailsHtml += `<p><strong>Details:</strong> ${fullMessage}</p>`; // More descriptive label for the full message

        // Extract date and time for consistency in modal
        let detailDate = 'N/A';
        let detailTime = 'N/A';
        if (incident['Timestamp']) {
            try {
                const ts = new Date(incident['Timestamp']);
                detailDate = ts.toLocaleDateString();
                detailTime = ts.toLocaleTimeString();
            } catch (e) { /* continue with N/A */ }
        } else if (incident['Flow Start']){
             try {
                 const ts = new Date(incident['Flow Start']);
                 detailDate = ts.toLocaleDateString();
                 detailTime = ts.toLocaleTimeString();
             } catch (e) { /* continue with N/A */ }
        } else {
            const now = new Date();
            detailDate = now.toLocaleDateString();
            detailTime = now.toLocaleTimeString();
        }
        detailsHtml += `<p><strong>Date:</strong> ${detailDate}</p>`;
        detailsHtml += `<p><strong>Time:</strong> ${detailTime}</p>`;

        detailsHtml += '<hr>';
        detailsHtml += '<h4>Key Network Flow Indicators:</h4>';

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
            if (incident.hasOwnProperty(key)) {
                // Display 'N/A' if value is null or empty, otherwise format numbers
                let value = incident[key];
                if (value === null || value === undefined || value === '') {
                    value = 'N/A';
                } else if (typeof value === 'number') {
                    value = value.toFixed(2); // Format numbers to 2 decimal places
                }
                detailsHtml += `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`;
            }
        });

        // Add all other keys not in the preferred order
        for (const key in incident) {
            if (incident.hasOwnProperty(key) &&
                !orderedKeys.includes(key) && // Exclude already added keys
                key !== 'Predicted_Threat_Label' &&
                key !== 'Message' &&
                key !== 'action' && // Exclude from IncidentLog if present
                key !== 'timestamp' && // Exclude from IncidentLog if present
                key !== 'Flow Start' &&
                key !== 'Timestamp' &&
                key !== 'id' && // Exclude internal ID if present
                key !== 'Incident ID' && // Exclude if it was the primary ID
                key !== 'Flow ID' && // Already handled for display
                key !== 'ID' // Exclude if it was the general ID
            ) {
                let value = incident[key];
                if (value === null || value === undefined || value === '') {
                    value = 'N/A';
                } else if (typeof value === 'number') {
                    value = value.toFixed(2);
                }
                detailsHtml += `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`;
            }
        }

        modalContent.innerHTML = detailsHtml;
        incidentDetailsModal.style.display = 'block';
    }


    // --- Event Listeners ---

    // Classify selected existing file
    classifySelectedFileBtn.addEventListener('click', async function() {
        const selectedFilename = uploadedFilesDropdown.value;
        if (!selectedFilename) {
            classificationMessage.textContent = 'Please select a file first.';
            classificationMessage.style.color = 'orange';
            return;
        }

        classificationMessage.textContent = 'Classifying selected file...';
        classificationMessage.style.color = 'blue';
        resultsCardsContainer.innerHTML = '<p>Loading results...</p>';

        try {
            const response = await fetch('/classify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename: selectedFilename })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            classificationMessage.textContent = `Classification complete for ${selectedFilename}.`;
            classificationMessage.style.color = 'green';
            displayResults(result);

        } catch (error) {
            console.error('Error classifying selected file:', error);
            classificationMessage.textContent = `Error classifying file: ${error.message}`;
            classificationMessage.style.color = 'red';
            resultsCardsContainer.innerHTML = '<p>Error loading results.</p>';
        }
    });

    // Upload and classify new file
    classifyNewFileBtn.addEventListener('click', async function() {
        const file = newClassificationFile.files[0];
        if (!file) {
            newClassificationMessage.textContent = 'Please select a file to upload and classify.';
            newClassificationMessage.style.color = 'orange';
            return;
        }

        newClassificationMessage.textContent = 'Uploading and classifying new file...';
        newClassificationMessage.style.color = 'blue';
        resultsCardsContainer.innerHTML = '<p>Loading results...</p>';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/classify', {
                method: 'POST',
                body: formData // No Content-Type header needed for FormData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            newClassificationMessage.textContent = `Classification complete for new file '${file.name}'.`;
            newClassificationMessage.style.color = 'green';
            displayResults(result);
            // After successful upload and classification, refresh the dropdown list
            fetchUploadedFiles();

        } catch (error) {
            console.error('Error uploading and classifying new file:', error);
            newClassificationMessage.textContent = `Error: ${error.message}`;
            newClassificationMessage.style.color = 'red';
            resultsCardsContainer.innerHTML = '<p>Error loading results.</p>';
        }
    });

    // Initial fetch of uploaded files when the page loads
    fetchUploadedFiles();
});