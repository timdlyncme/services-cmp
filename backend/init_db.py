from app.db.init_db import init_db
from app.db.session import SessionLocal

if __name__ == "__main__":
    db = SessionLocal()
    init_db(db)
    db.close()
    print("Database initialized successfully!")

