-- Migration: Add dashboard tables
-- Description: Creates tables for dashboard functionality including dashboards, dashboard_widgets, and user_widgets

-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id SERIAL PRIMARY KEY,
    dashboard_id UUID UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    layout JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create dashboard_widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id SERIAL PRIMARY KEY,
    widget_id UUID UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    widget_type VARCHAR NOT NULL,
    category VARCHAR NOT NULL,
    default_config JSONB,
    data_source VARCHAR NOT NULL,
    chart_type VARCHAR,
    min_width INTEGER DEFAULT 1,
    min_height INTEGER DEFAULT 1,
    default_width INTEGER DEFAULT 2,
    default_height INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_widgets table
CREATE TABLE IF NOT EXISTS user_widgets (
    id SERIAL PRIMARY KEY,
    user_widget_id UUID UNIQUE NOT NULL,
    custom_name VARCHAR,
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 2,
    height INTEGER NOT NULL DEFAULT 2,
    custom_config JSONB,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dashboard_id UUID NOT NULL REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
    widget_id UUID NOT NULL REFERENCES dashboard_widgets(widget_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_dashboard_id ON dashboards(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_widget_id ON dashboard_widgets(widget_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);
CREATE INDEX IF NOT EXISTS idx_user_widgets_dashboard_id ON user_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_user_widgets_widget_id ON user_widgets(widget_id);
CREATE INDEX IF NOT EXISTS idx_user_widgets_user_widget_id ON user_widgets(user_widget_id);

-- Insert default widgets
INSERT INTO dashboard_widgets (
    widget_id, name, description, widget_type, category, 
    default_config, data_source, chart_type, min_width, 
    min_height, default_width, default_height
) VALUES 
(
    gen_random_uuid(), 
    'Total Deployments', 
    'Shows the total number of deployments across all environments',
    'stat_card',
    'deployments',
    '{"icon": "database", "color": "blue"}',
    'deployments/stats/total',
    NULL,
    1, 1, 2, 1
),
(
    gen_random_uuid(),
    'Running Deployments',
    'Shows the number of currently running deployments',
    'stat_card',
    'deployments',
    '{"icon": "check-circle", "color": "green"}',
    'deployments/stats/running',
    NULL,
    1, 1, 2, 1
),
(
    gen_random_uuid(),
    'Failed Deployments',
    'Shows the number of failed deployments',
    'stat_card',
    'deployments',
    '{"icon": "alert-circle", "color": "red"}',
    'deployments/stats/failed',
    NULL,
    1, 1, 2, 1
),
(
    gen_random_uuid(),
    'Cloud Accounts',
    'Shows the total number of connected cloud accounts',
    'stat_card',
    'cloud_accounts',
    '{"icon": "cloud", "color": "purple"}',
    'cloud-accounts/stats/total',
    NULL,
    1, 1, 2, 1
),
(
    gen_random_uuid(),
    'Deployments by Provider',
    'Chart showing deployment distribution across cloud providers',
    'chart',
    'deployments',
    '{"showLegend": true, "showTooltip": true}',
    'deployments/stats/by-provider',
    'pie',
    2, 2, 3, 2
),
(
    gen_random_uuid(),
    'Deployment Status Over Time',
    'Line chart showing deployment status trends over time',
    'chart',
    'deployments',
    '{"showLegend": true, "showTooltip": true, "timeRange": "30d"}',
    'deployments/stats/timeline',
    'line',
    3, 2, 4, 2
),
(
    gen_random_uuid(),
    'Recent Deployments',
    'Table showing the most recent deployments',
    'table',
    'deployments',
    '{"limit": 10, "showStatus": true}',
    'deployments/recent',
    NULL,
    3, 2, 4, 3
),
(
    gen_random_uuid(),
    'Cloud Account Status',
    'Chart showing cloud account status distribution',
    'chart',
    'cloud_accounts',
    '{"showLegend": true, "showTooltip": true}',
    'cloud-accounts/stats/status',
    'doughnut',
    2, 2, 3, 2
)
ON CONFLICT (widget_id) DO NOTHING;

