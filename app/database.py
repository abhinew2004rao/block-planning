from collections.abc import Generator
from os import getenv

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

DATABASE_URL = getenv("DATABASE_URL", settings.database_url)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.db_echo,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables registered on Base.metadata."""
    from app import models as _models  # noqa: F401

    Base.metadata.create_all(bind=engine)
