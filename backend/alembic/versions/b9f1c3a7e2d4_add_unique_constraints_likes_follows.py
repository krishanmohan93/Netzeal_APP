"""add_unique_constraints_likes_follows

Revision ID: b9f1c3a7e2d4
Revises: refactor_auth_001
Create Date: 2026-02-25 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'b9f1c3a7e2d4'
down_revision = 'refactor_auth_001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Deduplicate existing likes before adding unique constraint
    op.execute(
        """
        DELETE FROM likes a
        USING likes b
        WHERE a.user_id = b.user_id
          AND a.post_id = b.post_id
          AND a.id > b.id
        """
    )

    # Deduplicate existing follows before adding unique constraint
    op.execute(
        """
        DELETE FROM follows a
        USING follows b
        WHERE a.follower_id = b.follower_id
          AND a.following_id = b.following_id
          AND a.id > b.id
        """
    )

    op.create_unique_constraint('uq_likes_user_post', 'likes', ['user_id', 'post_id'])
    op.create_unique_constraint('uq_follows_follower_following', 'follows', ['follower_id', 'following_id'])


def downgrade() -> None:
    op.drop_constraint('uq_follows_follower_following', 'follows', type_='unique')
    op.drop_constraint('uq_likes_user_post', 'likes', type_='unique')
