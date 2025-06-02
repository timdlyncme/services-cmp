import React, { useEffect, useState } from 'react';
import { UserWidget, dashboardService } from '../../services/dashboard-service';
import { ChartRenderer } from '../charts/ChartComponents';

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
        
        const response = await dashboardService.getWidgetData(
          userWidget.widget_template.widget_type,
          userWidget.widget_template.data_source || '',
          userWidget.widget_template.default_config || {},
          undefined // tenant_id - will use current user's tenant
        );
        
        setData(response.data);
      } catch (err) {
        console.error('Error fetching widget data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load widget data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userWidget.widget_template.widget_type, userWidget.widget_template.data_source]);

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
    const widgetType = userWidget.widget_template.widget_type;
    const config = userWidget.widget_template.default_config || {};

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
              {userWidget.widget_template.name}
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

      case 'getting_started':
        if (data?.tasks && data?.progress) {
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium">Getting Started</h4>
                <div className="text-xs text-gray-500">
                  {data.progress.completed}/{data.progress.total} completed
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${data.progress.percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(data.progress.percentage)}% complete
                </div>
              </div>

              {/* Task list */}
              <div className="space-y-3">
                {data.tasks.map((task: any, index: number) => (
                  <div key={task.id} className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      task.completed 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {task.completed ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium ${
                        task.completed ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {task.description}
                      </div>
                      {task.count > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          {task.count} configured
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {data.is_complete && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-xs text-green-700 font-medium">
                    🎉 Congratulations! You've completed the setup.
                  </div>
                </div>
              )}
            </div>
          );
        }
        break;

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
