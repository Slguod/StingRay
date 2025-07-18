# db_config.py
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://username:password@localhost:5432/forensics_db')

# db_config.py
DATABASE_URL = "postgresql://postgres:kpqnjtjh@127.0.0.1:5432/Stingray"
# Example for local PostgreSQL:
# DATABASE_URL = "postgresql://myuser:mypassword@localhost:5432/mydatabase"