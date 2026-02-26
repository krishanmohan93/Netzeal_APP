"""add_auth_verification_reset_fields

Revision ID: d2a9c7e4f1b0
Revises: b9f1c3a7e2d4
Create Date: 2026-02-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = "d2a9c7e4f1b0"
down_revision = "b9f1c3a7e2d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "refresh_token_version" not in columns:
        op.add_column("users", sa.Column("refresh_token_version", sa.Integer(), nullable=False, server_default="0"))

    if "email_verification_token" not in columns:
        op.add_column("users", sa.Column("email_verification_token", sa.String(length=128), nullable=True))

    if "email_verification_expires_at" not in columns:
        op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))

    if "password_reset_token" not in columns:
        op.add_column("users", sa.Column("password_reset_token", sa.String(length=128), nullable=True))

    if "password_reset_expires_at" not in columns:
        op.add_column("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "password_reset_expires_at" in columns:
        op.drop_column("users", "password_reset_expires_at")

    if "password_reset_token" in columns:
        op.drop_column("users", "password_reset_token")

    if "email_verification_expires_at" in columns:
        op.drop_column("users", "email_verification_expires_at")

    if "email_verification_token" in columns:
        op.drop_column("users", "email_verification_token")

    if "refresh_token_version" in columns:
        op.drop_column("users", "refresh_token_version")
