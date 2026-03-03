"""add ai_conversations table

Revision ID: 7f4d2c1b9a10
Revises: f1a2b3c4d5e6
Create Date: 2026-03-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f4d2c1b9a10"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "ai_conversations" not in table_names:
        op.create_table(
            "ai_conversations",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("message", sa.String(length=2000), nullable=False),
            sa.Column("response", sa.String(length=5000), nullable=False),
            sa.Column("intent", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("ai_conversations")}
    idx_id = op.f("ix_ai_conversations_id")
    idx_user = op.f("ix_ai_conversations_user_id")

    if idx_id not in existing_indexes:
        op.create_index(idx_id, "ai_conversations", ["id"], unique=False)
    if idx_user not in existing_indexes:
        op.create_index(idx_user, "ai_conversations", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_conversations_user_id"), table_name="ai_conversations")
    op.drop_index(op.f("ix_ai_conversations_id"), table_name="ai_conversations")
    op.drop_table("ai_conversations")
