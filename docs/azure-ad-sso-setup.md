# Azure AD SSO Setup Guide

This guide will walk you through setting up Single Sign-On (SSO) with Microsoft Azure Active Directory (Entra ID) for your application.

## Prerequisites

- Azure AD tenant with administrative access
- Application deployed and accessible via HTTPS
- Admin or MSP role in your application

## Step 1: Register Application in Azure Portal

1. **Navigate to Azure Portal**
   - Go to [Azure Portal](https://portal.azure.com)
   - Sign in with your Azure AD administrator account

2. **Access Azure Active Directory**
   - In the left navigation, click "Azure Active Directory"
   - Or search for "Azure Active Directory" in the search bar

3. **Register New Application**
   - Click "App registrations" in the left menu
   - Click "New registration"
   - Fill in the application details:
     - **Name**: Your application name (e.g., "My CMP Application")
     - **Supported account types**: Select "Accounts in this organizational directory only"
     - **Redirect URI**: Select "Web" and enter: `https://your-domain.com/auth/callback`

## Step 2: Configure Application Settings

1. **Note Important IDs**
   - After registration, copy the following from the Overview page:
     - **Application (client) ID**
     - **Directory (tenant) ID**

2. **Create Client Secret**
   - Go to "Certificates & secrets" in the left menu
   - Click "New client secret"
   - Add a description (e.g., "SSO Integration")
   - Select expiration period (recommended: 24 months)
   - Click "Add"
   - **Important**: Copy the secret value immediately (it won't be shown again)

## Step 3: Configure API Permissions

1. **Add Required Permissions**
   - Go to "API permissions" in the left menu
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions"
   - Add the following permissions:
     - `openid` (Sign users in)
     - `profile` (View users' basic profile)
     - `email` (View users' email address)
     - `User.Read` (Sign in and read user profile)

2. **Grant Admin Consent**
   - Click "Grant admin consent for [Your Organization]"
   - Confirm by clicking "Yes"

## Step 4: Configure Authentication

1. **Set Redirect URIs**
   - Go to "Authentication" in the left menu
   - Under "Web" platform, ensure your redirect URI is listed:
     - `https://your-domain.com/auth/callback`
   - Add additional URIs if needed (e.g., for development):
     - `http://localhost:3000/auth/callback`

2. **Configure Token Settings**
   - Under "Implicit grant and hybrid flows":
     - ✅ Check "ID tokens"
     - ✅ Check "Access tokens"
   - Under "Advanced settings":
     - ✅ Check "Allow public client flows" (if needed for mobile/desktop apps)

## Step 5: Configure Claims (Optional)

If you need custom claims in the tokens:

1. **Token Configuration**
   - Go to "Token configuration" in the left menu
   - Click "Add optional claim"
   - Select token type: "ID"
   - Add claims as needed:
     - `email`
     - `family_name`
     - `given_name`
     - `upn` (User Principal Name)

## Step 6: Configure Your Application

1. **Access SSO Settings**
   - Log into your application as an admin or MSP user
   - Navigate to Settings → SSO Setup

2. **Enter Azure AD Configuration**
   - **SSO Provider**: Select "Microsoft Entra ID (Azure AD)"
   - **Client ID**: Enter the Application (client) ID from Step 2
   - **Client Secret**: Enter the client secret from Step 2
   - **Azure Tenant ID**: Enter the Directory (tenant) ID from Step 2
   - **Enable SSO**: Toggle to enable SSO for your organization
   - **Enable SCIM**: Toggle if you want automatic user provisioning (optional)

3. **Save Configuration**
   - Click "Save SSO Configuration"
   - Verify the configuration is saved successfully

## Step 7: Test SSO Integration

1. **Test Login Flow**
   - Open a new incognito/private browser window
   - Navigate to your application's login page
   - Look for "Sign in with Azure AD" or similar SSO option
   - Click the SSO login button
   - You should be redirected to Azure AD login
   - After successful authentication, you should be redirected back to your application

2. **Verify User Creation**
   - Check that the user is created in your application's Users & Groups section
   - Verify that the user has the correct role and permissions

## Troubleshooting

### Common Issues

1. **"AADSTS50011: The reply URL specified in the request does not match the reply URLs configured for the application"**
   - **Solution**: Ensure the redirect URI in Azure AD exactly matches your application's callback URL

2. **"AADSTS700016: Application with identifier 'xxx' was not found in the directory"**
   - **Solution**: Verify the Client ID is correct and the application is registered in the correct tenant

3. **"AADSTS7000215: Invalid client secret is provided"**
   - **Solution**: Generate a new client secret and update your application configuration

4. **Users not being created automatically**
   - **Solution**: Ensure SCIM is enabled and properly configured, or manually create users in Users & Groups

### Verification Steps

1. **Check Azure AD Logs**
   - In Azure Portal, go to Azure Active Directory → Sign-ins
   - Look for authentication attempts from your application

2. **Verify Token Claims**
   - Use tools like [jwt.io](https://jwt.io) to decode and inspect JWT tokens
   - Ensure required claims (email, name, etc.) are present

3. **Test with Different Users**
   - Try logging in with different Azure AD users
   - Verify role mapping and permissions work correctly

## SCIM User Provisioning (Optional)

If you enabled SCIM provisioning:

1. **Configure SCIM Endpoint**
   - In Azure AD, go to Enterprise Applications
   - Find your application and click on it
   - Go to "Provisioning"
   - Set provisioning mode to "Automatic"
   - Enter your SCIM endpoint URL: `https://your-domain.com/api/scim/v2/Users`
   - Enter authentication credentials

2. **Configure Attribute Mappings**
   - Map Azure AD attributes to your application's user attributes
   - Common mappings:
     - `userPrincipalName` → `userName`
     - `mail` → `emails[type eq "work"].value`
     - `displayName` → `displayName`
     - `givenName` → `name.givenName`
     - `surname` → `name.familyName`

## Security Best Practices

1. **Client Secret Management**
   - Store client secrets securely (use environment variables or key vaults)
   - Rotate secrets regularly (before expiration)
   - Never commit secrets to version control

2. **Redirect URI Security**
   - Only use HTTPS for production redirect URIs
   - Keep redirect URIs as specific as possible
   - Regularly review and remove unused URIs

3. **Permission Scope**
   - Only request the minimum permissions needed
   - Regularly review granted permissions
   - Use least-privilege principle for user roles

4. **Monitoring**
   - Monitor Azure AD sign-in logs for suspicious activity
   - Set up alerts for failed authentication attempts
   - Regularly review user access and permissions

## Support

If you encounter issues not covered in this guide:

1. Check Azure AD documentation: [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
2. Review application logs for detailed error messages
3. Contact your system administrator or Azure support

---

**Note**: This guide assumes you're using the Microsoft Identity Platform v2.0 endpoints. Some steps may vary if you're using legacy Azure AD v1.0 endpoints.

