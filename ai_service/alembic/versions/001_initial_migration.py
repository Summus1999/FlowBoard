"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2026-03-04 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create tables for all models
    # Note: Actual tables will be created by SQLAlchemy's create_all()
    # This migration serves as the baseline
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # Drop all tables
    # Note: Actual table dropping would be implemented here
    pass
