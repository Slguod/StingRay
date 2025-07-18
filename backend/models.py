    # models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# Existing IncidentLog model (assuming it's already there)
class IncidentLog(db.Model):
    __tablename__ = 'incident_logs'
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    username = db.Column(db.String(80), nullable=False)
    action = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'username': self.username,
            'action': self.action
        }

# NEW: Model for your "Saved Entries" / "Forensic Datasets"
class DatasetEntry(db.Model):
    __tablename__ = 'dataset_entries'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    # Using Text for details to store potentially longer or JSON-stringified content
    details = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(50), nullable=False, default='manual') # e.g., 'manual', 'csv_upload', 'json_upload'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'details': self.details,
            'source': self.source,
            'created_at': self.created_at.isoformat()
        }

