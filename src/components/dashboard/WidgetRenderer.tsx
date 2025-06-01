import React, { useEffect, useState } from 'react';
import { UserWidget } from '../../services/dashboard-service';
import { ChartRenderer } from '../charts/ChartComponents';
import { getWidgetData } from '../../services/dashboard-service';

interface WidgetRendererProps {
  userWidget: UserWidget;
}

interface WidgetData {
  [key: string]: any;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ userWidget }) => {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await getWidgetData({
          widget_type: userWidget.dashboard_widget.widget_type,
          data_source: userWidget.dashboard_widget.data_source,
          config: userWidget.dashboard_widget.config || {},
          tenant_id: undefined // Will use current user's tenant
        });
        
        setData(response.data);
      } catch (err) {
        console.error('Error fetching widget data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load widget data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userWidget.dashboard_widget.widget_type, userWidget.dashboard_widget.data_source]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  const renderContent = () => {
    const widgetType = userWidget.dashboard_widget.widget_type;
    const config = userWidget.dashboard_widget.config || {};

    switch (widgetType) {
      case 'deployment_count':
      case 'cloud_account_count':
      case 'template_count':
        return (
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {data?.count || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {userWidget.dashboard_widget.name}
            </div>
          </div>
        );

      case 'deployments_by_provider_pie':
        if (data?.chart_data) {
          return (
            <div>
              <h4 className="text-sm font-medium mb-2">Deployments by Provider</h4>
              <ChartRenderer 
                data={data.chart_data} 
                type="pie"
                colors={['#8884d8', '#82ca9d', '#ffc658', '#ff7300']}
              />
            </div>
          );
        }
        break;

      case 'deployment_status_bar':
        if (data?.chart_data) {
          return (
            <div>
              <h4 className="text-sm font-medium mb-2">Deployment Status</h4>
              <ChartRenderer 
                data={data.chart_data} 
                type="bar"
                colors={['#10b981', '#f59e0b', '#ef4444']}
              />
            </div>
          );
        }
        break;

      case 'deployment_timeline':
        if (data?.chart_data) {
          return (
            <div>
              <h4 className="text-sm font-medium mb-2">Deployment Timeline</h4>
              <ChartRenderer 
                data={data.chart_data} 
                type="line"
                colors={['#3b82f6']}
              />
            </div>
          );
        }
        break;

      case 'recent_deployments':
        if (data?.deployments) {
          return (
            <div>
              <h4 className="text-sm font-medium mb-2">Recent Deployments</h4>
              <div className="space-y-2">
                {data.deployments.slice(0, 5).map((deployment: any, index: number) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="truncate">{deployment.name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      deployment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      deployment.status === 'failed' ? 'bg-red-100 text-red-800' :
                      deployment.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {deployment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'cloud_accounts_status':
        if (data?.accounts) {
          return (
            <div>
              <h4 className="text-sm font-medium mb-2">Cloud Account Status</h4>
              <div className="space-y-2">
                {data.accounts.slice(0, 5).map((account: any, index: number) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-gray-500">{account.provider}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      account.status === 'connected' ? 'bg-green-100 text-green-800' :
                      account.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {account.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'welcome_message':
        return (
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Welcome to Your Dashboard</h3>
            <p className="text-sm text-gray-600">
              Customize your dashboard by adding widgets and arranging them to your preference.
            </p>
          </div>
        );

      case 'quick_actions':
        return (
          <div>
            <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 rounded">
                Create Deployment
              </button>
              <button className="w-full text-left px-3 py-2 text-xs bg-green-50 hover:bg-green-100 rounded">
                Add Cloud Account
              </button>
              <button className="w-full text-left px-3 py-2 text-xs bg-purple-50 hover:bg-purple-100 rounded">
                Browse Templates
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500">
            <div className="text-sm">Widget type: {widgetType}</div>
            <div className="text-xs mt-1">Data: {JSON.stringify(data)}</div>
          </div>
        );
    }

    return (
      <div className="text-center text-gray-500">
        No data available for this widget
      </div>
    );
  };

  return (
    <div className="h-full p-4">
      {renderContent()}
    </div>
  );
};

