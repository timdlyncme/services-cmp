from app.models.cloud_settings import CloudSettings
from app.api.endpoints.deployments import set_azure_credentials
import inspect

# Print the CloudSettings model attributes
print("CloudSettings attributes:")
for attr in dir(CloudSettings):
    if not attr.startswith('_'):
        print(f"  - {attr}")

# Print the CloudSettings model columns
print("\nCloudSettings columns:")
for column in CloudSettings.__table__.columns:
    print(f"  - {column.name}: {column.type}")

# Print the set_azure_credentials function signature
print("\nset_azure_credentials function signature:")
print(inspect.signature(set_azure_credentials))

# Print the function source code
print("\nset_azure_credentials function source code:")
print(inspect.getsource(set_azure_credentials))

