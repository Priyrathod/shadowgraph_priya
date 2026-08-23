"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa


revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'scan_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('scan_type', sa.String(length=64), nullable=False),
        sa.Column('payload_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scan_events_id', 'scan_events', ['id'], unique=False)
    op.create_index('ix_scan_events_user_id', 'scan_events', ['user_id'], unique=False)
    op.create_index('ix_scan_events_scan_type', 'scan_events', ['scan_type'], unique=False)

    op.create_table(
        'user_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('profile_visible', sa.Integer(), nullable=False),
        sa.Column('allow_aggregation', sa.Integer(), nullable=False),
        sa.Column('breach_alerts', sa.Integer(), nullable=False),
        sa.Column('light_theme', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_settings_id', 'user_settings', ['id'], unique=False)
    op.create_index('ix_user_settings_user_id', 'user_settings', ['user_id'], unique=True)

    op.create_table(
        'audit_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=80), nullable=False),
        sa.Column('details_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_events_id', 'audit_events', ['id'], unique=False)
    op.create_index('ix_audit_events_user_id', 'audit_events', ['user_id'], unique=False)
    op.create_index('ix_audit_events_event_type', 'audit_events', ['event_type'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_audit_events_event_type', table_name='audit_events')
    op.drop_index('ix_audit_events_user_id', table_name='audit_events')
    op.drop_index('ix_audit_events_id', table_name='audit_events')
    op.drop_table('audit_events')

    op.drop_index('ix_user_settings_user_id', table_name='user_settings')
    op.drop_index('ix_user_settings_id', table_name='user_settings')
    op.drop_table('user_settings')

    op.drop_index('ix_scan_events_scan_type', table_name='scan_events')
    op.drop_index('ix_scan_events_user_id', table_name='scan_events')
    op.drop_index('ix_scan_events_id', table_name='scan_events')
    op.drop_table('scan_events')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
