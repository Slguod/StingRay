# --- CHANGED: Removed the trailing comma, as it can cause syntax errors in some versions of Python. ---
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
from werkzeug.utils import secure_filename
import os
import subprocess
from urllib.parse import urlparse
import pandas as pd
import openpyxl
from datetime import datetime, timezone

# --- CHANGED: Removed the redundant 'app = Flask(__name__)' as it was defined twice. ---
app = Flask(__name__,
            template_folder='../frontend/templates',
            static_folder='../frontend/static')

CORS(app) # Enable CORS for all origins

# Database configuration (using environment variable or a default)
# IMPORTANT: Replace 'YOUR_PASSWORD' with your actual PostgreSQL password.
# For production, use environment variables (e.g., set DB_USER, DB_PASSWORD in your system)
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:kpqnjtjh@127.0.0.1:5432/Stingray')
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploaded_data_files')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class IncidentLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.String(50), nullable=False)
    username = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp,
            'username': self.username,
            'action': self.action
        }

class DatasetEntry(db.Model):
    # This model exists for the database schema, but is not actively used by current UI functions
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'details': self.details,
            'created_at': self.created_at.isoformat()
        }

# Helper function for logging incidents
def log_incident(username='system', action='unspecified action'):
    try:
        new_log = IncidentLog(
            timestamp=datetime.now(timezone.utc),
            username=username,
            action=action
        )
        db.session.add(new_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging incident: {e}")

# Function to create tables (Called once at application startup)
def create_tables():
    db.create_all()
    # Log initial setup only if the IncidentLog table is empty
    if IncidentLog.query.count() == 0:
        log_incident('system', 'Database tables initialized and connected.')

# --- ROUTES ---

# --- CHANGED: Consolidated redundant routes. '/dashboard' route remains separate. ---
@app.route('/')
@app.route('/login')
def login_page():
    return render_template('Stingray_Login.html')

# Route to serve the registration page
@app.route('/register')
def register_page():
    return render_template('Register.html')

# Route to serve the dashboard
@app.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')

# Endpoint to get all incident logs
@app.route('/api/incidents', methods=['GET'])
def get_incidents():
    try:
        logs = IncidentLog.query.all()
        return jsonify([log.to_dict() for log in logs]), 200
    except Exception as e:
        print(f"Error fetching incidents: {e}")
        return jsonify({"error": f"Failed to fetch incidents: {str(e)}"}), 500

# Endpoint to get all existing dataset entries (not used by current UI, but part of models)
@app.route('/api/entries', methods=['GET'])
def get_entries():
    try:
        entries = DatasetEntry.query.all()
        return jsonify([entry.to_dict() for entry in entries]), 200
    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({"error": f"Failed to fetch entries: {str(e)}"}), 500


# Endpoint to create a new dataset entry (not used by current UI, but part of models)
@app.route('/api/entry', methods=['POST'])
def create_entry():
    data = request.get_json()
    name = data.get('name')
    details = data.get('details')
    if not name:
        return jsonify({"message": "Entry name is required"}), 400
    try:
        new_entry = DatasetEntry(name=name, details=details)
        db.session.add(new_entry)
        db.session.commit()
        log_incident('system', f"New data entry '{name}' created.")
        return jsonify({"message": "Entry created successfully!"}), 201
    except Exception as e:
        print(f"Error creating entry: {e}")
        return jsonify({"error": f"Failed to create entry: {str(e)}"}), 500


# Endpoint: GET all databases
@app.route('/api/databases', methods=['GET'])
def get_databases():
    try:
        databases = db.session.execute(
            db.text("SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname;")
        ).scalars().all()

        filtered_databases = [
            db_name for db_name in databases
            if db_name not in ['postgres', 'template0', 'template1']
        ]
        return jsonify(filtered_databases), 200
    except Exception as e:
        print(f"Error fetching databases: {e}")
        return jsonify({"error": f"Failed to fetch databases: {str(e)}"}), 500

# Endpoint: POST to create a new database
@app.route('/api/create_database', methods=['POST'])
def create_database():
    data = request.get_json()
    db_name = data.get('db_name')

    if not db_name:
        return jsonify({"message": "Database name is required."}), 400

    # Basic validation for database name (alphanumeric and underscores)
    if not db_name.replace('_', '').isalnum():
        return jsonify({"message": "Invalid database name. Use alphanumeric characters and underscores only."}), 400

    try:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        parsed_url = urlparse(DATABASE_URL)
        db_user_temp = parsed_url.username or 'postgres'
        db_password_temp = parsed_url.password or ''
        db_host_temp = parsed_url.hostname or '127.0.0.1'
        db_port_temp = parsed_url.port or 5432

        # Connect to the default 'postgres' database to create a new one
        temp_db_url = f"postgresql://{db_user_temp}:{db_password_temp}@{db_host_temp}:{db_port_temp}/postgres"

        temp_engine = create_engine(temp_db_url)
        TempSession = sessionmaker(bind=temp_engine)
        temp_session = TempSession()

        # Execute the CREATE DATABASE command
        temp_session.execute(db.text(f'CREATE DATABASE "{db_name}"'))
        temp_session.commit() # Commit the transaction
        temp_session.close() # Close the session
        temp_engine.dispose() # Dispose of the engine

        log_incident('user', f"New database '{db_name}' created.")
        return jsonify({"message": f"Database '{db_name}' created successfully!"}), 201
    except Exception as e:
        if "already exists" in str(e):
            return jsonify({"message": f"Database '{db_name}' already exists."}), 409
        print(f"Error creating database '{db_name}': {e}")
        return jsonify({"error": f"Failed to create database: {str(e)}"}), 500

# Endpoint: POST to upload CSV/Excel files for storage
@app.route('/api/upload_database_dump', methods=['POST'])
def handle_data_and_file_upload(): # Renamed function for clarity in backend
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    # The 'table_name' will now be expected from the form data
    if 'table_name' not in request.form:
        return jsonify({"error": "No target table name provided"}), 400

    file = request.files['file']
    table_name = request.form.get('table_name', '').strip()

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not table_name:
        return jsonify({"error": "Target table name cannot be empty"}), 400

    file_extension = file.filename.rsplit('.', 1)[1].lower()
    if file_extension not in ['csv', 'xls', 'xlsx']:
        return jsonify({"error": "Unsupported file type. Please upload a CSV or Excel (.xls/.xlsx) file."}), 400

    # Sanitize table name (basic alphanumeric/underscore check)
    if not table_name.replace('_', '').isalnum():
        return jsonify({"error": "Invalid table name. Use alphanumeric characters and underscores only."}), 400

    # --- CHANGED: Used the global UPLOAD_FOLDER for consistency. ---
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(filepath) # Always save the original file to disk for user access

        # Now, read and insert data into PostgreSQL
        if file_extension == 'csv':
            df = pd.read_csv(filepath)
        elif file_extension in ['xls', 'xlsx']:
            df = pd.read_excel(filepath)
        else:
            # This case should ideally be caught by the earlier check
            return jsonify({"error": "Unsupported file type for database import."}), 400


        df.to_sql(table_name, db.engine, if_exists='replace', index=False)

        log_incident('user', f"Data from '{filename}' uploaded and inserted into table '{table_name}'. Original file also stored.")
        return jsonify({"message": f"Data from '{filename}' successfully uploaded and inserted into table '{table_name}'. Original file also stored for download!"}), 200

    except Exception as e:
        print(f"Error during data upload to DB: {e}")
        # If an error occurs during processing, remove the potentially incomplete file
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Server error during data upload to database: {str(e)}"}), 500


# --- CHANGED: This is the most critical change. It now reads from the directory instead of a hardcoded list. ---
# Endpoint: GET list of uploaded files (for downloading original files)
@app.route('/api/uploaded_files')
def get_uploaded_files():
    try:
        # Get the list of all files in the UPLOAD_FOLDER
        uploaded_files = os.listdir(UPLOAD_FOLDER)
        return jsonify(uploaded_files)
    except FileNotFoundError:
        # If the directory doesn't exist, return an empty list
        return jsonify([])
    except Exception as e:
        print(f"Error listing files: {e}")
        return jsonify({"error": f"Server error listing files: {str(e)}"}), 500

# Endpoint: GET to download a specific uploaded file
# --- CHANGED: Uses the globally defined UPLOAD_FOLDER for consistency. ---
@app.route('/api/download_file/<filename>', methods=['GET'])
def download_uploaded_file(filename):
    try:
        # send_from_directory is now given an absolute path, which is more reliable
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)
    except FileNotFoundError:
        print(f"File not found for download: {filename} in {UPLOAD_FOLDER}")
        return jsonify({"error": "File not found."}), 404
    except Exception as e:
        print(f"General error downloading file {filename}: {e}")
        return jsonify({"error": f"Failed to download file: {str(e)}"}), 500
    
@app.route('/api/calendar_activity', methods=['GET'])
def get_calendar_activity():
    try:
        username = request.args.get('username')
        
        query = IncidentLog.query
        if username:
            query = query.filter_by(username=username)

        incidents = query.order_by(IncidentLog.timestamp).all()
        
        activity_dates = set()
        for incident in incidents:
            if incident.timestamp:
                try:
                    dt_object = datetime.strptime(str(incident.timestamp), '%Y-%m-%d %H:%M:%S.%f%z')
                    activity_dates.add(dt_object.strftime('%Y-%m-%d'))
                except ValueError:
                    try:
                        dt_object = datetime.strptime(str(incident.timestamp), '%Y-%m-%d %H:%M:%S%z')
                        activity_dates.add(dt_object.strftime('%Y-%m-%d'))
                    except ValueError:
                        continue
        sorted_dates = sorted(list(activity_dates))
        
        return jsonify(sorted_dates), 200
    except Exception as e:
        print(f"Error in get_calendar_activity: {e}")
        return jsonify({'error': 'Failed to fetch calendar activity'}), 500
    
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        users = db.session.execute(
            db.text("SELECT DISTINCT username FROM incident_log ORDER BY username;")
        ).scalars().all()
        return jsonify(users), 200
    except Exception as e:
        print(f"Error fetching users: {e}")
        return jsonify({'error': 'Failed to fetch users'}), 500
    
# This block runs only when app.py is executed directly
if __name__ == '__main__':
    with app.app_context(): # Essential for SQLAlchemy operations at startup
        create_tables()
    app.run(debug=True)