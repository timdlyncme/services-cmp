from app.db.init_db import init_db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Initializing database")
    init_db()

