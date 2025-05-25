from app.models.cloud_settings import CloudSettings

try:
    cs = CloudSettings(
        provider='azure',
        name='test',
        connection_details={'client_id': 'test'}
    )
    print('Success!')
except Exception as e:
    print(f'Error: {e}')

