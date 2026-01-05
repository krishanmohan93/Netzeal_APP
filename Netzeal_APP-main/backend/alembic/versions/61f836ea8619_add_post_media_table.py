"""add_post_media_table

Revision ID: 61f836ea8619
Revises: 0f34624a8c5c
Create Date: 2025-11-18 23:24:27.727231

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '61f836ea8619'
down_revision = '0f34624a8c5c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hashtags column to posts
    op.add_column('posts', sa.Column('hashtags', sa.String(600), nullable=True))
    
    # Create post_media table
    op.create_table(
        'post_media',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('media_type', sa.Enum('IMAGE', 'VIDEO', 'PDF', name='mediatype'), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('thumb_url', sa.String(1000), nullable=True),
        sa.Column('order_index', sa.Integer(), default=0),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('is_reel', sa.Boolean(), default=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Create index on post_id
    op.create_index('ix_post_media_post_id', 'post_media', ['post_id'])


def downgrade() -> None:
    # Drop post_media table
    op.drop_index('ix_post_media_post_id', 'post_media')
    op.drop_table('post_media')
    
    # Drop hashtags column
    op.drop_column('posts', 'hashtags')
    
    # Drop enum type
    op.execute('DROP TYPE IF EXISTS mediatype')
