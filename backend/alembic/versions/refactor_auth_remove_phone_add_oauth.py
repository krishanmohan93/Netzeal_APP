"""Refactor auth: add OAuth provider fields

Revision ID: refactor_auth_001
Revises: 3d69b1b007d5
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'refactor_auth_001'
down_revision = '3d69b1b007d5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = {col["name"] for col in inspector.get_columns("users")}
    indexes = {idx["name"] for idx in inspector.get_indexes("users")}

    # Add auth_provider column (email or google)
    if "auth_provider" not in columns:
        op.add_column(
            "users",
            sa.Column("auth_provider", sa.String(50), nullable=False, server_default="email"),
        )

    # Add provider_id for OAuth support
    if "provider_id" not in columns:
        op.add_column("users", sa.Column("provider_id", sa.String(255), nullable=True))

    if "ix_users_provider_id" not in indexes:
        op.create_index("ix_users_provider_id", "users", ["provider_id"], unique=True)

    # Add Google OAuth refresh token storage
    if "google_refresh_token" not in columns:
        op.add_column("users", sa.Column("google_refresh_token", sa.String(500), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = {col["name"] for col in inspector.get_columns("users")}
    indexes = {idx["name"] for idx in inspector.get_indexes("users")}

    if "ix_users_provider_id" in indexes:
        op.drop_index("ix_users_provider_id", table_name="users")

    if "google_refresh_token" in columns:
        op.drop_column("users", "google_refresh_token")

    if "provider_id" in columns:
        op.drop_column("users", "provider_id")

    if "auth_provider" in columns:
        op.drop_column("users", "auth_provider")
