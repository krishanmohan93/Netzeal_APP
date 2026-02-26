"""add_unique_constraint_bookmarks

Revision ID: f1a2b3c4d5e6
Revises: d2a9c7e4f1b0
Create Date: 2026-02-26 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "d2a9c7e4f1b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM bookmarks a
        USING bookmarks b
        WHERE a.user_id = b.user_id
          AND a.post_id = b.post_id
          AND a.id > b.id
        """
    )

    op.create_unique_constraint(
        "uq_bookmarks_user_post",
        "bookmarks",
        ["user_id", "post_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_bookmarks_user_post", "bookmarks", type_="unique")
