// Function: fetch and display files in a table
async function displayDatabases() {
    try {
        const response = await fetch('/api/uploaded_files');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        
        const tableBody = document.getElementById('uploadedFilesTableBody');
        tableBody.innerHTML = ''; // Clear existing content

        if (files.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 2;
            cell.textContent = 'No files uploaded yet.';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        files.forEach(fileName => {
            const row = document.createElement('tr');
            const fileNameCell = document.createElement('td');
            const downloadCell = document.createElement('td');
            
            fileNameCell.textContent = fileName;
            
            const downloadLink = document.createElement('a');
            downloadLink.href = `/api/download_file/${encodeURIComponent(fileName)}`;
            downloadLink.textContent = 'Download';
            downloadLink.target = "_blank";
            downloadLink.download = fileName;
            
            downloadCell.appendChild(downloadLink);
            
            row.appendChild(fileNameCell);
            row.appendChild(downloadCell);
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching uploaded files:', error);
        const tableBody = document.getElementById('uploadedFilesTableBody');
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 2;
        cell.style.color = 'red';
        cell.textContent = `Error loading uploaded files: ${error.message}`;
        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}

// Function: fetch and display incident logs in a table
async function displayIncidents() {
    try {
        const response = await fetch('/api/incidents');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const incidents = await response.json();
        
        const tableBody = document.getElementById('incidentLogTableBody');
        tableBody.innerHTML = ''; // Clear existing logs to prevent duplicates

        if (incidents.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.textContent = 'No incidents have been logged yet.';
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        incidents.forEach(incident => {
            const row = document.createElement('tr');
            const timestampCell = document.createElement('td');
            const usernameCell = document.createElement('td');
            const actionCell = document.createElement('td');
            
            timestampCell.textContent = incident.timestamp;
            usernameCell.textContent = incident.username;
            actionCell.textContent = incident.action;
            
            row.appendChild(timestampCell);
            row.appendChild(usernameCell);
            row.appendChild(actionCell);
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching incident logs:', error);
        const tableBody = document.getElementById('incidentLogTableBody');
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 3;
        cell.style.color = 'red';
        cell.textContent = `Error loading incident logs: ${error.message}`;
        row.appendChild(cell);
        tableBody.appendChild(row);
    }
}

// Function: create a new database
async function createDatabase() {
    const databaseNameInput = document.getElementById('databaseName');
    const db_name = databaseNameInput.value.trim();

    if (!db_name) {
        alert('Please enter a name for the new database.');
        return;
    }

    try {
        const response = await fetch('/api/create_database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ db_name: db_name })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
        }

        alert(data.message);
        databaseNameInput.value = '';
        await displayDatabases(); 
    } catch (error) {
        console.error('Error creating database:', error);
        alert('Error creating database: ' + error.message);
    }
}

// Function: Upload Data File
async function uploadDatabaseDump() {
    const fileInput = document.getElementById('dumpFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a CSV or Excel file.');
        return;
    }

    const target_table_name = prompt("Please enter the target table name for the database import (leave blank to only store file):");
    
    if (target_table_name === null) {
        alert("File upload cancelled.");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('table_name', target_table_name.trim());

    try {
        const response = await fetch('/api/upload_database_dump', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        alert(data.message);
        fileInput.value = '';
        await displayDatabases(); 
    } catch (error) {
        console.error('Error during data and file upload:', error);
        alert('Error during data and file upload: ' + error.message);
    }
}

// Add event listeners for the new button IDs
document.addEventListener('DOMContentLoaded', () => {
    displayDatabases();
    displayIncidents();
    displayActivityCalendar();

    const createDbButton = document.getElementById('createDbButton');
    const uploadDbButton = document.getElementById('uploadDbButton');
    const saveDbButton = document.getElementById('saveDbButton');
    const uploadFileButton = document.getElementById('uploadFileButton');

    if (createDbButton) {
        createDbButton.addEventListener('click', () => {
            document.getElementById('createDbForm').style.display = 'block';
            document.getElementById('uploadDbForm').style.display = 'none';
        });
    }

    if (uploadDbButton) {
        uploadDbButton.addEventListener('click', () => {
            document.getElementById('uploadDbForm').style.display = 'block';
            document.getElementById('createDbForm').style.display = 'none';
        });
    }
    
    if (saveDbButton) {
        saveDbButton.addEventListener('click', createDatabase);
    }

    if (uploadFileButton) {
        uploadFileButton.addEventListener('click', uploadDatabaseDump);
    }
});

// Function to generate and display the calendar
async function displayActivityCalendar() {
    try {
        const response = await fetch('/api/calendar_activity');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const activeDates = await response.json();

        // Create a Set for fast lookup
        const activeDatesSet = new Set(activeDates);

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthName = now.toLocaleString('default', { month: 'long' });

        const firstDayOfMonth = new Date(year, month, 1);
        const startingDay = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const calendarHeader = document.getElementById('calendar-header');
        const calendarGrid = document.getElementById('calendar-grid');

        calendarHeader.textContent = `${monthName} ${year}`;

        // Add empty grid cells for the days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day');
            calendarGrid.appendChild(emptyCell);
        }

        // Populate the grid with days and highlight active ones
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            const dayCell = document.createElement('div');
            dayCell.textContent = day;
            dayCell.classList.add('calendar-day');

            if (activeDatesSet.has(dateString)) {
                dayCell.classList.add('active-day');
            }
            calendarGrid.appendChild(dayCell);
        }

    } catch (error) {
        console.error('Error fetching calendar activity:', error);
        const calendarContainer = document.getElementById('incident-calendar-container');
        if (calendarContainer) {
            calendarContainer.innerHTML = `<p style="color:red;">Error loading calendar: ${error.message}</p>`;
        }
    }
}