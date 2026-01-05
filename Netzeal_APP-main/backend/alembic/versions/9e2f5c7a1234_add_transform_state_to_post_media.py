"""add_transform_state_to_post_media

Revision ID: 9e2f5c7a1234
Revises: 61f836ea8619
Create Date: 2025-11-19 12:00:00

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9e2f5c7a1234'
down_revision = '61f836ea8619'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('post_media', sa.Column('transform_state', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('post_media', 'transform_state')
