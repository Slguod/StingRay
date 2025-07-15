// script.js
const BACKEND_URL = 'http://127.0.0.1:5000';

// --- Function to fetch and display ALL available databases ---
async function displayDatabases() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/databases`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const databases = await response.json();
    const databaseList = document.getElementById('databaseList');
    databaseList.innerHTML = '';

    if (databases.length === 0) {
      databaseList.innerHTML = '<li>No user-created databases found.</li>';
      return;
    }

    databases.forEach(dbName => {
      const listItem = document.createElement('li');
      listItem.textContent = dbName;
      databaseList.appendChild(listItem);
    });
  } catch (error) {
    console.error('Error fetching databases:', error);
    document.getElementById('databaseList').innerHTML = `<li style="color:red;">Error loading databases: ${error.message}</li>`;
  }
}

// --- Function: create a new database ---
async function createDatabase() {
  const databaseNameInput = document.getElementById('databaseName');
  const db_name = databaseNameInput.value.trim();

  if (!db_name) {
    alert('Please enter a name for the new database.');
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/create_database`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db_name: db_name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    alert(data.message);
    databaseNameInput.value = '';
    await displayDatabases();
  } catch (error) {
    console.error('Error creating database:', error);
    alert('Error creating database: ' + error.message);
  }
}

// --- Function: upload database dump file for storage (MODIFIED) ---
async function uploadDatabaseDump() { // Function name remains, but functionality changes
  const fileInput = document.getElementById('dumpFile');
  const file = fileInput.files[0];

  if (!file) {
    alert('Please select a CSV or Excel file to upload.'); // Updated alert
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  // Removed: formData.append('target_db', target_db); as it's no longer needed

  try {
    const response = await fetch(`${BACKEND_URL}/api/upload_database_dump`, { // Same endpoint, new behavior
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    alert(data.message);
    fileInput.value = ''; // Clear file input
    // No need to call displayDatabases() here, as we're just storing a file
  } catch (error) {
    console.error('Error uploading data file:', error); // Updated error message
    alert('Error uploading data file: ' + error.message); // Updated alert
  }
}



// --- Fetch and display incidents from Flask + PostgreSQL (IncidentLog) ---
fetch(`${BACKEND_URL}/api/incidents`)
  .then(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
  })
  .then(data => {
    const tbody = document.getElementById('incident-log');
    tbody.innerHTML = '';
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No incidents logged yet.</td></tr>';
      return;
    }
    data.forEach(log => {
      const row = document.createElement('tr');
      const timestampPart = log.timestamp ? String(log.timestamp).split(' ')[1] : '';
      row.innerHTML = `<td>${log.timestamp}</td><td>${log.username}</td><td>${log.action}</td><td>${timestampPart}</td>`;
      tbody.appendChild(row);
    });
  })
  .catch(error => {
    console.error('Error fetching incidents:', error);
    document.getElementById('incident-log').innerHTML = `<tr><td colspan="4" style="color:red;">Error loading incidents: ${error.message}</td></tr>`;
  });

// --- UI Toggling Logic for Input Forms (MODIFIED) ---
function hideAllInputForms() {
  document.getElementById('createDbForm').style.display = 'none';
  document.getElementById('uploadDbForm').style.display = 'none';
  // Removed: document.getElementById('uploadDataFileForm').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // Initial display of databases
  displayDatabases();

  // Hide all forms initially
  hideAllInputForms();

  // Attach click listeners to the main action buttons
  document.getElementById('createDbButton').addEventListener('click', () => {
    hideAllInputForms();
    document.getElementById('createDbForm').style.display = 'block';
  });

  document.getElementById('uploadDbButton').addEventListener('click', () => {
    hideAllInputForms();
    document.getElementById('uploadDbForm').style.display = 'block';
  });

  // Removed: Event listener for uploadDataButton
});
