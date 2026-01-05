"""Add UUID public_id, connections, conversations_v2, messages_v2

Revision ID: c1b2e3d4add
Revises: 9e2f5c7a1234
Create Date: 2025-12-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c1b2e3d4add'
down_revision = '9e2f5c7a1234'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure pgcrypto for gen_random_uuid
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    # Add public_id to users
    op.add_column(
        'users',
        sa.Column('public_id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=True)
    )
    op.execute("UPDATE users SET public_id = gen_random_uuid() WHERE public_id IS NULL;")
    op.alter_column('users', 'public_id', nullable=False)
    op.create_unique_constraint('uq_users_public_id', 'users', ['public_id'])
    op.create_index('ix_users_public_id', 'users', ['public_id'], unique=False)

    # Connections table (UUID based)
    op.create_table(
        'connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('follower_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.public_id', ondelete='CASCADE'), nullable=False),
        sa.Column('following_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.public_id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='connected', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('follower_id', 'following_id', name='uq_connections_pair')
    )
    op.create_index('ix_connections_follower', 'connections', ['follower_id'])
    op.create_index('ix_connections_following', 'connections', ['following_id'])

    # Conversations_v2 table (direct chats keyed by user pair)
    op.create_table(
        'conversations_v2',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_a_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.public_id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_b_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.public_id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_a_id', 'user_b_id', name='uq_conversations_v2_pair')
    )
    op.create_index('ix_conversations_v2_user_a', 'conversations_v2', ['user_a_id'])
    op.create_index('ix_conversations_v2_user_b', 'conversations_v2', ['user_b_id'])
    op.create_index('ix_conversations_v2_last_message', 'conversations_v2', ['last_message_at'])

    # Messages_v2 table
    op.create_table(
        'messages_v2',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations_v2.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.public_id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index('ix_messages_v2_conversation', 'messages_v2', ['conversation_id'])
    op.create_index('ix_messages_v2_sender', 'messages_v2', ['sender_id'])
    op.create_index('ix_messages_v2_created_at', 'messages_v2', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_messages_v2_created_at', table_name='messages_v2')
    op.drop_index('ix_messages_v2_sender', table_name='messages_v2')
    op.drop_index('ix_messages_v2_conversation', table_name='messages_v2')
    op.drop_table('messages_v2')

    op.drop_index('ix_conversations_v2_last_message', table_name='conversations_v2')
    op.drop_index('ix_conversations_v2_user_b', table_name='conversations_v2')
    op.drop_index('ix_conversations_v2_user_a', table_name='conversations_v2')
    op.drop_table('conversations_v2')

    op.drop_index('ix_connections_following', table_name='connections')
    op.drop_index('ix_connections_follower', table_name='connections')
    op.drop_table('connections')

    op.drop_index('ix_users_public_id', table_name='users')
    op.drop_constraint('uq_users_public_id', 'users', type_='unique')
    op.drop_column('users', 'public_id')

    # Note: extension not removed
