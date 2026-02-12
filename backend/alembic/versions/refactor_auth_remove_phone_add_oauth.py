"""Refactor auth: remove phone/OTP, add auth_provider and password_hash

Revision ID: refactor_auth_001
Revises: fa878e124ea5_add_firebase_auth_fields_to_users
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'refactor_auth_001'
down_revision = 'fa878e124ea5_add_firebase_auth_fields_to_users'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add auth_provider column (email or google)
    op.add_column('users', sa.Column('auth_provider', sa.String(50), nullable=True, server_default='email'))
    
    # Rename firebase_uid to provider_id for general OAuth support
    op.add_column('users', sa.Column('provider_id', sa.String(255), nullable=True, unique=True, index=True))
    
    # Remove phone number related columns
    op.drop_column('users', 'phone_number')
    op.drop_column('users', 'firebase_uid')
    
    # Add Google OAuth fields
    op.add_column('users', sa.Column('google_refresh_token', sa.String(500), nullable=True))


def downgrade() -> None:
    # Reverse the changes
    op.drop_column('users', 'google_refresh_token')
    op.drop_column('users', 'provider_id')
    op.drop_column('users', 'auth_provider')
    
    # Restore phone number columns
    op.add_column('users', sa.Column('firebase_uid', sa.String(128), nullable=True, unique=True, index=True))
    op.add_column('users', sa.Column('phone_number', sa.String(20), nullable=True, unique=True, index=True))
