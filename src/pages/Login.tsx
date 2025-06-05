import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ssoService } from '../services/sso-service';

const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'sso'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if this is an SSO callback
  useEffect(() => {
    const handleSSOCallback = async () => {
      if (ssoService.isCallbackUrl()) {
        setSsoLoading(true);
        try {
          const response = await ssoService.handleCallbackFromUrl();
          
          // Store token and user data
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', JSON.stringify(response.user));
          
          // Navigate to dashboard
          navigate('/dashboard');
        } catch (error) {
          console.error('SSO callback error:', error);
          setSsoError(error instanceof Error ? error.message : 'SSO authentication failed');
          // Clean up URL
          window.history.replaceState({}, document.title, '/login');
        } finally {
          setSsoLoading(false);
        }
      }
    };

    handleSSOCallback();
  }, [navigate]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async (provider: 'azure_ad') => {
    setSsoLoading(true);
    setSsoError('');

    try {
      let domain: string | undefined;
      
      // If user entered an email, extract domain for better SSO experience
      if (email) {
        domain = ssoService.getDomainFromEmail(email);
      }

      let loginUrl: string;
      
      switch (provider) {
        case 'azure_ad':
          loginUrl = await ssoService.getAzureADLoginUrl(domain);
          break;
        default:
          throw new Error(`Unsupported SSO provider: ${provider}`);
      }

      // Redirect to SSO provider
      window.location.href = loginUrl;
    } catch (error) {
      console.error('SSO login error:', error);
      setSsoError(error instanceof Error ? error.message : 'Failed to initiate SSO login');
      setSsoLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError('');
    setSsoError('');
  };

  // Show loading screen during SSO callback processing
  if (ssoLoading && ssoService.isCallbackUrl()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Completing SSO Login...
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we complete your authentication.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 px-4 text-center font-medium text-sm ${
              activeTab === 'credentials'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('credentials')}
          >
            Email & Password
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center font-medium text-sm ${
              activeTab === 'sso'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('sso')}
          >
            Single Sign-On
          </button>
        </div>

        {/* Credentials Tab */}
        {activeTab === 'credentials' && (
          <form className="mt-8 space-y-6" onSubmit={handleCredentialsSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={handleEmailChange}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        )}

        {/* SSO Tab */}
        {activeTab === 'sso' && (
          <div className="mt-8 space-y-6">
            {/* Email input for domain detection */}
            <div>
              <label htmlFor="sso-email" className="block text-sm font-medium text-gray-700">
                Email address (optional)
              </label>
              <input
                id="sso-email"
                name="sso-email"
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your work email for better SSO experience"
                value={email}
                onChange={handleEmailChange}
              />
              <p className="mt-1 text-xs text-gray-500">
                We'll use your email domain to provide the best SSO experience
              </p>
            </div>

            {ssoError && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
                {ssoError}
              </div>
            )}

            {/* SSO Providers */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleSSOLogin('azure_ad')}
                disabled={ssoLoading}
                className="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" fill="#00BCF2"/>
                </svg>
                {ssoLoading ? 'Redirecting...' : 'Continue with Microsoft'}
              </button>

              {/* Future SSO providers can be added here */}
              <div className="text-center text-sm text-gray-500">
                More SSO providers coming soon
              </div>
            </div>

            {/* Switch to credentials */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setActiveTab('credentials')}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Use email and password instead
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>
            Don't have an account?{' '}
            <span className="text-blue-600">Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

