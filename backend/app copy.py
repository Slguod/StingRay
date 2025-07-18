
import numpy as np
import joblib # For loading .pkl files
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
from sklearn.preprocessing import StandardScaler, PolynomialFeatures # For preprocessing
from sklearn.feature_selection import SelectKBest, f_classif # For feature selection
from xgboost import XGBClassifier # Make sure XGBoost is installed and the class is available


# --- Flask App Configuration ---
app = Flask(__name__,
            template_folder='../frontend/templates',
            static_folder='../frontend/static')

CORS(app) # Enable CORS for all origins

# Database configuration (using environment variable or a default)
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:Lukomon99@127.0.0.1:5432/Stingray')
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploaded_data_files')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- NEW: Model Folder and Global Model Variables ---
MODEL_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models') # Define the models folder path

# Ensure UPLOAD_FOLDER and MODEL_FOLDER exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

# These will hold the loaded model and preprocessing components
best_xgb_model = None
scaler = None
selector = None
label_encoder_original = None
label_encoder_filtered = None

# Paths to your saved model components within the 'models' folder
MODEL_PATH = os.path.join(MODEL_FOLDER, 'best_xgboost_model_with_fe.pkl')
SCALER_PATH = os.path.join(MODEL_FOLDER, 'scaler.pkl')
SELECTOR_PATH = os.path.join(MODEL_FOLDER, 'feature_selector.pkl')
LABEL_ENCODER_ORIGINAL_PATH = os.path.join(MODEL_FOLDER, 'label_encoder_original.pkl')
LABEL_ENCODER_FILTERED_PATH = os.path.join(MODEL_FOLDER, 'label_encoder_filtered.pkl')

# --- Database Models (Existing) ---
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

# Helper function for logging incidents (Existing)
def log_incident(username='system', action='unspecified action'):
    try:
        new_log = IncidentLog(
            timestamp=datetime.now(timezone.utc).isoformat(), # Store as ISO format string
            username=username,
            action=action
        )
        db.session.add(new_log)
        db.session.commit()
    except Exception as e:
        print(f"Error logging incident: {e}")

# Function to create tables (Called once at application startup) (Existing)
def create_tables():
    db.create_all()
    if IncidentLog.query.count() == 0:
        log_incident('system', 'Database tables initialized and connected.')


# --- NEW: Model Loading and Classification Functions ---
def load_all_model_components():
    """
    Loads all necessary model and preprocessing components into global variables.
    This function should be called once when your web server starts.
    """
    global best_xgb_model, scaler, selector, label_encoder_original, label_encoder_filtered
    app.logger.info("Attempting to load saved model components...")
    try:
        best_xgb_model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        selector = joblib.load(SELECTOR_PATH)
        label_encoder_original = joblib.load(LABEL_ENCODER_ORIGINAL_PATH)
        label_encoder_filtered = joblib.load(LABEL_ENCODER_FILTERED_PATH)
        app.logger.info("Model components loaded successfully.")
    except FileNotFoundError as e:
        app.logger.error(f"Error loading model components: {e}. Make sure all .pkl files are in the '{MODEL_FOLDER}' directory.")
        raise RuntimeError(f"Critical error: Model component not found - {e}")
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during model component loading: {e}", exc_info=True)
        raise RuntimeError(f"Critical error: Failed to load model components - {e}")

def classify_uploaded_data(data_df: pd.DataFrame, source_id: str) -> pd.DataFrame:
    """
    Takes a Pandas DataFrame of uploaded data, preprocesses it, and classifies threats.
    
    Args:
        data_df (pd.DataFrame): The DataFrame containing the uploaded data.
        source_id (str): A unique identifier for the uploaded file (e.g., filename).

    Returns:
        pd.DataFrame: A DataFrame containing the original data rows with
                      an added 'Predicted_Threat_Label' column.
    """
    if not all([best_xgb_model, scaler, selector, label_encoder_original, label_encoder_filtered]):
        app.logger.error("Error: Model components not loaded for classification.")
        raise RuntimeError("Model components not initialized. Server setup error.")

    app.logger.info(f"Processing data for classification from source: {source_id}")
    
    original_data_for_output = data_df.copy() # Keep a copy for merging results

    # Initial data cleaning for the input DataFrame
    if 'Label' in data_df.columns:
        data_df = data_df.drop('Label', axis=1)
    if 'Label_encoded' in data_df.columns:
        data_df = data_df.drop('Label_encoded', axis=1)
    
    # Clean column names (strip whitespace)
    data_df.columns = data_df.columns.str.strip()

    # Handle null values (drop rows with nulls in new data too)
    data_df_processed = data_df.dropna()
    original_data_for_output = original_data_for_output.loc[data_df_processed.index].copy()

    # Filter out numerical columns and handle infinites/NaNs specifically for numerical operations
    numerical_cols_for_prediction = data_df_processed.select_dtypes(include=np.number).columns
    data_numerical = data_df_processed[numerical_cols_for_prediction].copy()
    
    data_numerical.replace([np.inf, -np.inf], np.nan, inplace=True)
    # Drop rows where numerical values became NaN due to inf replacement or original NaNs in numerical columns
    data_numerical.dropna(inplace=True)

    # Ensure original_data_for_output still aligns after potential further numerical NaNs
    original_data_for_output = original_data_for_output.loc[data_numerical.index].copy()

    data_numerical = data_numerical.astype(np.float32)

    # --- Feature Engineering on New Data (Exact same as training) ---
    epsilon = 1e-6 # Small constant to avoid division by zero

    # Ratio Features
    data_numerical['fwd_bwd_pkt_len_ratio'] = data_numerical['Fwd Packet Length Mean'] / (data_numerical['Bwd Packet Length Mean'] + epsilon)
    data_numerical['pkt_len_max_min_ratio'] = data_numerical['Max Packet Length'] / (data_numerical['Min Packet Length'] + epsilon)
    data_numerical['bytes_per_packet'] = data_numerical['Flow Bytes/s'] / (data_numerical['Flow Packets/s'] + epsilon)
    data_numerical['fwd_pkt_per_bwd_pkt'] = data_numerical['Total Fwd Packets'] / (data_numerical['Total Backward Packets'] + epsilon)
    data_numerical['fwd_bytes_per_bwd_bytes'] = data_numerical['Total Length of Fwd Packets'] / (data_numerical['Total Length of Bwd Packets'] + epsilon)
    data_numerical['fwd_header_len_ratio'] = data_numerical['Fwd Header Length'] / (data_numerical['Bwd Header Length'] + epsilon)

    # Polynomial Features (make sure these columns exist after previous steps if they are used)
    poly_features_subset = [
        'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
        'Flow Bytes/s', 'Flow Packets/s', 'Fwd Packet Length Mean',
        'Bwd Packet Length Mean', 'Min Packet Length', 'Max Packet Length'
    ]
    # Filter for columns that actually exist in the processed numerical data
    existing_poly_features = [col for col in poly_features_subset if col in data_numerical.columns]

    if existing_poly_features:
        poly_temp = PolynomialFeatures(degree=2, include_bias=False)
        X_poly_transformed = poly_temp.fit_transform(data_numerical[existing_poly_features])
        poly_feature_names = poly_temp.get_feature_names_out(existing_poly_features)
        data_processed = pd.concat([data_numerical, pd.DataFrame(X_poly_transformed, columns=poly_feature_names, index=data_numerical.index)], axis=1)
    else:
        data_processed = data_numerical.copy()

    # Scale the data using the LOADED scaler
    X_scaled = scaler.transform(data_processed)

    # Select features using the LOADED selector
    X_selected = selector.transform(X_scaled)

    # --- Make Predictions ---
    predictions_encoded = best_xgb_model.predict(X_selected)
    prediction_probabilities = best_xgb_model.predict_proba(X_selected) # Get probabilities for logging (if needed later)

    # --- Decode Predictions back to original labels ---
    # Map encoded predictions back to filtered labels first, then to original labels
    filtered_classes_mapping = label_encoder_filtered.inverse_transform(np.arange(len(label_encoder_filtered.classes_)))
    final_decoded_predictions = label_encoder_original.inverse_transform(filtered_classes_mapping[predictions_encoded]) # Corrected indexing here

    # Add predictions to the original data copy that will be returned
    original_data_for_output['Predicted_Threat_Label'] = final_decoded_predictions

    # Log detected threats
    for index, row in original_data_for_output.iterrows():
        predicted_label = row['Predicted_Threat_Label']
        if predicted_label != 'Benign': # Log only if it's a detected threat
            log_action = f"Threat Detected: {predicted_label} (Row from {source_id})"
            log_incident(username='threat_detector', action=log_action)

    app.logger.info(f"Classification complete for {source_id}. Returning results.")
    return original_data_for_output


# --- ROUTES (Existing and Modified) ---

# --- HTML Page Routes (Existing) ---
@app.route('/')
@app.route('/login')
def login_page():
    return render_template('Stingray_Login.html')

@app.route('/register')
def register_page():
    return render_template('Register.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/reports')
def reports():
    return render_template('reports.html')

@app.route('/threat-detection')
def threat_detection():
    return render_template('threat-detection.html')

@app.route('/userprofile')
def user_profile():
    return render_template('userprofile.html')

# Endpoint to get all incident logs (Existing)
@app.route('/api/incidents', methods=['GET'])
def get_incidents():
    try:
        # Define patterns for actions that are NOT considered 'threats' or
        # that the user wants to filter out (system/data management logs).
        # Using '%' as a wildcard for SQL LIKE/ILIKE for partial matches.
        excluded_action_patterns = [
            '%Database tables initialized%', # Excludes "Database tables initialized and connected."
            '%New data entry%',             # Excludes "New data entry '...' created."
            '%New database%',               # Excludes "New database '...' created."
            '%uploaded and inserted into table%', # Excludes "Data from '...' uploaded and inserted into table '...'. Original file also stored."
        ]

        # Start with the base query for IncidentLog
        query = IncidentLog.query

        # Apply NOT ILIKE (case-insensitive LIKE) for each excluded pattern
        for pattern in excluded_action_patterns:
            query = query.filter(db.not_(IncidentLog.action.ilike(pattern)))
        
        # Order by timestamp for consistent display
        logs = query.order_by(IncidentLog.timestamp.desc()).all()

        return jsonify([log.to_dict() for log in logs]), 200
    except Exception as e:
        app.logger.error(f"Error fetching incidents: {e}", exc_info=True)
        return jsonify({"error": f"Failed to fetch incidents: {str(e)}"}), 500
# Endpoint to get all existing dataset entries (Existing)
@app.route('/api/entries', methods=['GET'])
def get_entries():
    try:
        entries = DatasetEntry.query.all()
        return jsonify([entry.to_dict() for entry in entries]), 200
    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({"error": f"Failed to fetch entries: {str(e)}"}), 500

# Endpoint to create a new dataset entry (Existing)
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

# Endpoint: GET all databases (Existing)
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

# Endpoint: POST to create a new database (Existing)
@app.route('/api/create_database', methods=['POST'])
def create_database():
    data = request.get_json()
    db_name = data.get('db_name')

    if not db_name:
        return jsonify({"message": "Database name is required."}), 400

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

        temp_db_url = f"postgresql://{db_user_temp}:{db_password_temp}@{db_host_temp}:{db_port_temp}/postgres"

        temp_engine = create_engine(temp_db_url)
        TempSession = sessionmaker(bind=temp_engine)
        temp_session = TempSession()

        temp_session.execute(db.text(f'CREATE DATABASE "{db_name}"'))
        temp_session.commit()
        temp_session.close()
        temp_engine.dispose()

        log_incident('user', f"New database '{db_name}' created.")
        return jsonify({"message": f"Database '{db_name}' created successfully!"}), 201
    except Exception as e:
        if "already exists" in str(e):
            return jsonify({"message": f"Database '{db_name}' already exists."}), 409
        print(f"Error creating database '{db_name}': {e}")
        return jsonify({"error": f"Failed to create database: {str(e)}"}), 500

# Endpoint: POST to upload CSV/Excel files for storage (Existing)
@app.route('/api/upload_database_dump', methods=['POST'])
def handle_data_and_file_upload():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
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

    if not table_name.replace('_', '').isalnum():
        return jsonify({"error": "Invalid table name. Use alphanumeric characters and underscores only."}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    try:
        file.save(filepath)

        if file_extension == 'csv':
            df = pd.read_csv(filepath)
        elif file_extension in ['xls', 'xlsx']:
            df = pd.read_excel(filepath)
        else:
            return jsonify({"error": "Unsupported file type for database import."}), 400

        df.to_sql(table_name, db.engine, if_exists='replace', index=False)

        log_incident('user', f"Data from '{filename}' uploaded and inserted into table '{table_name}'. Original file also stored.")
        return jsonify({"message": f"Data from '{filename}' successfully uploaded and inserted into table '{table_name}'. Original file also stored for download!"}), 200

    except Exception as e:
        print(f"Error during data upload to DB: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Server error during data upload to database: {str(e)}"}), 500

# Endpoint: GET list of uploaded files (Existing)
@app.route('/api/uploaded_files')
def get_uploaded_files():
    try:
        uploaded_files = os.listdir(UPLOAD_FOLDER)
        # Filter for only CSV and Excel files, as these are typically the ones for classification
        filtered_files = [f for f in uploaded_files if f.endswith(('.csv', '.xls', '.xlsx'))]
        return jsonify(filtered_files)
    except FileNotFoundError:
        return jsonify([])
    except Exception as e:
        print(f"Error listing files: {e}")
        return jsonify({"error": f"Server error listing files: {str(e)}"}), 500

# Endpoint: GET to download a specific uploaded file (Existing)
@app.route('/api/download_file/<filename>', methods=['GET'])
def download_uploaded_file(filename):
    try:
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

        # Define patterns to exclude from calendar activity
        excluded_action_patterns = ['Benign'] # Actions containing 'Benign'

        incidents = query.order_by(IncidentLog.timestamp).all()

        activity_dates = set()
        for incident in incidents:
            # Apply the same filtering logic here
            is_excluded = False
            for pattern in excluded_action_patterns:
                if pattern in incident.action:
                    is_excluded = True
                    break

            if not is_excluded and incident.timestamp:
                try:
                    # Attempt to parse with microseconds and timezone
                    dt_object = datetime.strptime(str(incident.timestamp), '%Y-%m-%d %H:%M:%S.%f%z')
                    activity_dates.add(dt_object.strftime('%Y-%m-%d'))
                except ValueError:
                    # Fallback for timestamps without microseconds but with timezone
                    try:
                        dt_object = datetime.strptime(str(incident.timestamp), '%Y-%m-%d %H:%M:%S%z')
                        activity_dates.add(dt_object.strftime('%Y-%m-%d'))
                    except ValueError:
                        # Fallback for timestamps without timezone (if any exist)
                        try:
                            dt_object = datetime.strptime(str(incident.timestamp), '%Y-%m-%d %H:%M:%S.%f')
                            activity_dates.add(dt_object.strftime('%Y-%m-%d'))
                        except ValueError:
                            app.logger.warning(f"Could not parse timestamp format for calendar activity: {incident.timestamp}")
                            continue # Skip unparseable timestamps

        sorted_dates = sorted(list(activity_dates))

        return jsonify(sorted_dates), 200
    except Exception as e:
        app.logger.error(f"Error in get_calendar_activity: {e}", exc_info=True)
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
        
# --- MODIFIED: Threat Classification Model Endpoint ---
# --- MODIFIED: Threat Classification Model Endpoint ---
@app.route('/classify', methods=['POST'])
def classify():
    file = None
    filename_from_request = None

    # Check if a file is uploaded directly
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file in upload"}), 400
        filename_from_request = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename_from_request)
        try:
            file.save(filepath) # Save the newly uploaded file for classification
            app.logger.info(f"New file '{filename_from_request}' uploaded for classification.")
        except Exception as e:
            app.logger.error(f"Error saving newly uploaded file for classification: {e}", exc_info=True)
            return jsonify({"error": f"Failed to save uploaded file: {str(e)}"}), 500
    
    # Check if a filename is provided in JSON (for already uploaded files)
    elif request.is_json:
        data = request.get_json()
        filename_from_request = data.get('filename')
        if not filename_from_request:
            return jsonify({"error": "No filename provided in JSON payload"}), 400
        
        # Ensure the requested file exists in UPLOAD_FOLDER
        filepath = os.path.join(UPLOAD_FOLDER, secure_filename(filename_from_request))
        if not os.path.exists(filepath):
            return jsonify({"error": f"File '{filename_from_request}' not found on server."}), 404
        app.logger.info(f"Using existing file '{filename_from_request}' for classification.")
    else:
        return jsonify({"error": "No file uploaded or filename provided"}), 400

    # Determine file extension to read correctly
    file_extension = filepath.rsplit('.', 1)[1].lower()
    if file_extension not in ['csv', 'xls', 'xlsx']:
        return jsonify({"error": "Invalid file type. Please upload a CSV or Excel file."}), 400

    try:
        # Read the file into a DataFrame from its saved location
        if file_extension == 'csv':
            df = pd.read_csv(filepath)
        else: # xls or xlsx
            df = pd.read_excel(filepath)

        classified_df = classify_uploaded_data(df, source_id=filename_from_request) 
        
        # --- NEW: Filter out 'Benign' rows before sending to frontend ---
        # Only include rows where 'Predicted_Threat_Label' is not 'Benign'
        non_benign_results = classified_df[classified_df['Predicted_Threat_Label'] != 'Benign']
        
        # If no threats are detected, send an empty list
        if non_benign_results.empty:
            app.logger.info(f"No threats detected in {filename_from_request}. Sending empty results.")
            return jsonify([]) # Send an empty array if all are benign or no threats found
        else:
            return jsonify(non_benign_results.to_dict(orient='records'))

    except Exception as e:
        app.logger.error(f"Error processing file for classification: {e}", exc_info=True)
        return jsonify({"error": f"Error processing file for classification: {e}"}), 500

# This block runs only when app.py is executed directly
if __name__ == '__main__':
    with app.app_context(): # Essential for SQLAlchemy operations at startup
        create_tables()
        load_all_model_components() # NEW: Load model components here after tables are created
    app.run(debug=True)