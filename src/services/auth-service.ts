// This file serves as a proxy to the appropriate auth service implementation
// based on the environment (browser vs. server)

import { AuthService as BrowserAuthService } from './auth-service-browser';

// Export the browser-compatible version
export const AuthService = BrowserAuthService;

// Export the AuthUser interface
export type { AuthUser } from './auth-service-browser';

