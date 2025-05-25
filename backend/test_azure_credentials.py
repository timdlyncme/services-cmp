from app.models.cloud_settings import CloudSettings
from app.models.user import User, Tenant
import uuid

# Mock objects
class MockTenant:
    def __init__(self):
        self.tenant_id = str(uuid.uuid4())

class MockUser:
    def __init__(self):
        self.tenant = MockTenant()

# Test function
def test_create_credentials():
    try:
        # Create mock user
        current_user = MockUser()
        
        # Create credentials
        new_creds = CloudSettings(
            provider="azure",
            name="Test Credentials",
            connection_details={
                "client_id": "test-client-id",
                "client_secret": "test-client-secret",
                "tenant_id": "test-tenant-id"
            },
            organization_tenant_id=current_user.tenant.tenant_id
        )
        
        print("Successfully created CloudSettings object")
        print(f"Provider: {new_creds.provider}")
        print(f"Name: {new_creds.name}")
        print(f"Connection Details: {new_creds.connection_details}")
        print(f"Organization Tenant ID: {new_creds.organization_tenant_id}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_create_credentials()

