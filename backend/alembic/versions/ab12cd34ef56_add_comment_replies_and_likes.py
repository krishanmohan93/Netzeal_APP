"""add comment replies + comment likes

Revision ID: ab12cd34ef56
Revises: 7f4d2c1b9a10
Create Date: 2026-04-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ab12cd34ef56"
down_revision: Union[str, None] = "7f4d2c1b9a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "comments" in table_names:
        existing_columns = {col["name"] for col in inspector.get_columns("comments")}
        if "parent_id" not in existing_columns:
            op.add_column("comments", sa.Column("parent_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_comments_parent_id",
                "comments",
                "comments",
                ["parent_id"],
                ["id"],
                ondelete="CASCADE",
            )
        if "likes_count" not in existing_columns:
            op.add_column("comments", sa.Column("likes_count", sa.Integer(), server_default="0", nullable=False))
        if "replies_count" not in existing_columns:
            op.add_column("comments", sa.Column("replies_count", sa.Integer(), server_default="0", nullable=False))

        existing_indexes = {idx["name"] for idx in inspector.get_indexes("comments")}
        idx_parent = "ix_comments_parent_id"
        if idx_parent not in existing_indexes:
            op.create_index(idx_parent, "comments", ["parent_id"], unique=False)

    if "comment_likes" not in table_names:
        op.create_table(
            "comment_likes",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("comment_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", "comment_id", name="uq_comment_likes_user_comment"),
        )

        op.create_index(op.f("ix_comment_likes_id"), "comment_likes", ["id"], unique=False)
        op.create_index(op.f("ix_comment_likes_comment_id"), "comment_likes", ["comment_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "comment_likes" in table_names:
        op.drop_index(op.f("ix_comment_likes_comment_id"), table_name="comment_likes")
        op.drop_index(op.f("ix_comment_likes_id"), table_name="comment_likes")
        op.drop_table("comment_likes")

    if "comments" in table_names:
        existing_columns = {col["name"] for col in inspector.get_columns("comments")}
        if "parent_id" in existing_columns:
            op.drop_index("ix_comments_parent_id", table_name="comments")
            op.drop_constraint("fk_comments_parent_id", "comments", type_="foreignkey")
            op.drop_column("comments", "parent_id")
        if "likes_count" in existing_columns:
            op.drop_column("comments", "likes_count")
        if "replies_count" in existing_columns:
            op.drop_column("comments", "replies_count")
