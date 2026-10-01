"""Add media and tournament end date; protect duplicate team entries without deleting data."""
from alembic import op
import sqlalchemy as sa
revision='7a10_media_registration'
down_revision='3fc1ead4d14d'
branch_labels=None
depends_on=None


def upgrade():
    connection=op.get_bind()
    duplicate=connection.execute(sa.text('SELECT tournament_id FROM registrations WHERE team_id IS NOT NULL GROUP BY tournament_id,team_id HAVING COUNT(*)>1 LIMIT 1')).first()
    if duplicate:
        raise RuntimeError('Migration stopped: duplicate team registrations exist. Review and reconcile them before retrying. No rows were deleted.')
    op.add_column('tournaments',sa.Column('end_date',sa.DateTime(),nullable=True))
    with op.batch_alter_table('registrations') as batch:
        batch.create_unique_constraint('uq_registration_tournament_team',['tournament_id','team_id'])
        batch.create_index('ix_registration_tournament_status',['tournament_id','status'])
    op.create_table('media',
        sa.Column('id',sa.Integer(),primary_key=True),
        sa.Column('title',sa.String(160),nullable=False),
        sa.Column('description',sa.Text(),nullable=False),
        sa.Column('media_type',sa.String(24),nullable=False),
        sa.Column('video_url',sa.String(2000),nullable=False),
        sa.Column('thumbnail_url',sa.String(2000),nullable=False),
        sa.Column('tournament_id',sa.Integer(),sa.ForeignKey('tournaments.id')),
        sa.Column('game',sa.String(32),sa.ForeignKey('games.slug')),
        sa.Column('status',sa.String(16),nullable=False),
        sa.Column('featured',sa.Boolean(),nullable=False),
        sa.Column('created_by',sa.Integer(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('published_at',sa.DateTime()),
        sa.Column('created_at',sa.DateTime(),nullable=False),
        sa.Column('updated_at',sa.DateTime(),nullable=False))
    op.create_index('ix_media_tournament_id','media',['tournament_id'])
    op.create_index('ix_media_created_by','media',['created_by'])
    op.create_index('ix_media_public','media',['status','featured','published_at'])


def downgrade():
    # Data-preserving rollback: old application code ignores these additions.
    # Never silently drop published media during a production rollback.
    raise RuntimeError('Use application rollback with the additive schema retained; destructive downgrade is intentionally disabled.')
