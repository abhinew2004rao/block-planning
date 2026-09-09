from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    version = conn.execute(text("SELECT version()")).scalar()
    print(f"Connected to PostgreSQL: {version}")
