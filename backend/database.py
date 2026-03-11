import os
from contextlib import contextmanager

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv(override=True)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

_engine = create_engine(DATABASE_URL)
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@contextmanager
def get_session():
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db():
    """FastAPI dependency: yields a Session and closes it after the request."""
    with get_session() as session:
        yield session
