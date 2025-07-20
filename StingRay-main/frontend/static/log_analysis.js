document.addEventListener('DOMContentLoaded', async function() {
    // Get references to new filter elements
    const incidentFilterDropdown = document.getElementById('incidentFilter');
    const applyFilterBtn = document.getElementById('applyFilterBtn');

    // Helper function to get the CSS class for a threat badge
    function getThreatBadgeClass(threatLabel) {
        threatLabel = String(threatLabel).toLowerCase();

        if (threatLabel.includes('benign')) {
            return 'Benign';
        }

        if (threatLabel.includes('ddos') ||
            threatLabel.includes('infiltration') ||
            threatLabel.includes('bot') ||
            threatLabel.includes('dos goldeneye') ||
            threatLabel.includes('dos hulk') ||
            threatLabel.includes('dos slowloris') ||
            threatLabel.includes('threat detected: high')) {
            return 'High';
        } else if (threatLabel.includes('portscan') ||
                   threatLabel.includes('brute force') ||
                   threatLabel.includes('xss') ||
                   threatLabel.includes('sql injection') ||
                   threatLabel.includes('ftp patator') ||
                   threatLabel.includes('threat detected: moderate')) {
            return 'Moderate';
        } else if (threatLabel.includes('low') ||
                   threatLabel.includes('normal') ||
                   threatLabel.includes('threat detected: low')) {
            return 'Low';
        } else {
            return 'Unknown';
        }
    }

    let pieChartInstance = null;
    let barChartInstance = null;

    // Function to fetch and render chart data with a filter
    async function fetchChartData(numIncidents = 30) { // Default to 30 incidents
        const chartMessage = document.getElementById('chartMessage');
        if (chartMessage) {
            chartMessage.style.display = 'block';
            chartMessage.textContent = `Loading charts for last ${numIncidents} incidents...`;
            chartMessage.style.color = 'blue';
        }

        try {
            // Include num_incidents as a query parameter
            const response = await fetch(`/api/threat_metrics?num_incidents=${numIncidents}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (chartMessage) {
                chartMessage.style.display = 'none'; // Hide loading message
            }

            // Destroy existing chart instances if they exist
            if (pieChartInstance) {
                pieChartInstance.destroy();
            }
            if (barChartInstance) {
                barChartInstance.destroy();
            }

            // Render Pie Chart
            const pieCtx = document.getElementById('severityPieChart').getContext('2d');
            pieChartInstance = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: ['High', 'Moderate', 'Low', 'Unknown'],
                    datasets: [{
                        data: [
                            data.pie_chart_data.High,
                            data.pie_chart_data.Moderate,
                            data.pie_chart_data.Low,
                            data.pie_chart_data.Unknown
                        ],
                        backgroundColor: [
                            '#f44336', // Red (High)
                            '#ff9800', // Orange (Moderate)
                            '#4CAF50', // Green (Low)
                            '#6c757d'  // Grey (Unknown)
                        ],
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed !== null) { label += context.parsed + '%'; }
                                    return label;
                                }
                            }
                        },
                        legend: { position: 'right' }
                    }
                }
            });

            // Render Bar Chart
            const barCtx = document.getElementById('threatTypesBarChart').getContext('2d');
            barChartInstance = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: data.bar_chart_data.labels,
                    datasets: [{
                        label: 'Number of Incidents',
                        data: data.bar_chart_data.values,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.7)',
                            'rgba(54, 162, 235, 0.7)',
                            'rgba(255, 206, 86, 0.7)',
                            'rgba(75, 192, 192, 0.7)'
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(75, 192, 192, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: { display: false },
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Number of Incidents' },
                            ticks: { precision: 0 }
                        },
                        x: {
                            title: { display: true, text: 'Threat Type' },
                            ticks: {
                    maxRotation: 45, // Rotate labels up to 45 degrees if they would overlap
                    minRotation: 0,  // Keep them horizontal if there's enough space
                    font: {
                        size: 10 // Make font slightly smaller to fit more labels
                    },
                    autoSkip: true,  // Allow Chart.js to automatically skip labels if too crowded
                    autoSkipPadding: 10 // Add some padding when skipping
                        }
                        }  
                    }
                }
            });

        } catch (error) {
            console.error('Failed to load chart data:', error);
            if (chartMessage) {
                chartMessage.textContent = `Failed to load chart data: ${error.message}`;
                chartMessage.style.color = 'red';
            }
        }
    }

    // Function to fetch and render incident logs (unaffected by graph filter)
    async function fetchIncidentLogs() {
        const tableBody = document.querySelector('#incidentLogTable tbody');
        const logTableMessage = document.getElementById('logTableMessage');
        tableBody.innerHTML = '';
        if (logTableMessage) {
            logTableMessage.textContent = 'Loading incident logs...';
            logTableMessage.style.color = 'blue';
        }

        try {
            const response = await fetch('/api/incidents'); // Corrected endpoint
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const logs = await response.json();

            if (logs.length > 0) {
                if (logTableMessage) {
                    logTableMessage.textContent = '';
                }
                logs.forEach(log => {
                    const row = tableBody.insertRow();
                    row.insertCell().textContent = log.timestamp;
                    row.insertCell().textContent = log.source_ip || 'N/A'; // Will be 'N/A' unless backend sends it
                    row.insertCell().textContent = log.action;

                    const severityCell = row.insertCell();
                    const badgeClass = getThreatBadgeClass(log.action); // Use action string for severity derivation
                    severityCell.innerHTML = `<span class="threat-level-badge ${badgeClass}">${log.severity || badgeClass}</span>`;

                    row.insertCell().textContent = log.details || 'N/A'; // Will be 'N/A' unless backend sends it
                });
            } else {
                if (logTableMessage) {
                    logTableMessage.textContent = 'No incident logs to display.';
                    logTableMessage.style.color = 'orange';
                }
            }
        } catch (error) {
            console.error('Error fetching incident logs:', error);
            if (logTableMessage) {
                logTableMessage.textContent = `Error loading incident logs: ${error.message}`;
                logTableMessage.style.color = 'red';
            }
        }
    }

    // Event listener for the "Apply Filter" button
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', function() {
            const selectedValue = incidentFilterDropdown.value;
            fetchChartData(parseInt(selectedValue)); // Pass the selected number to fetchChartData
        });
    }

    // Event listener for the "Add More Graphs" button
    const addMoreGraphsBtn = document.getElementById('addMoreGraphsBtn');
    if (addMoreGraphsBtn) {
        addMoreGraphsBtn.addEventListener('click', function() {
            alert('Add More Graphs button clicked! (Functionality to be implemented)');
            console.log('Add More Graphs button clicked!');
        });
    }

    // Initial load: Fetch charts with the default selected value (30)
    fetchChartData(parseInt(incidentFilterDropdown.value));
    // Initial load: Fetch all incident logs for the table
    fetchIncidentLogs();

    // Sidebar functions
    function w3_open() {
        document.getElementById("mySidebar").style.display = "block";
        document.getElementById("myOverlay").style.display = "block";
    }

    function w3_close() {
        document.getElementById("mySidebar").style.display = "none";
        document.getElementById("myOverlay").style.display = "none";
    }
});