from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS

def create_app():
    app = Flask(__name__)
    
    # Configure app
    app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # Change this in production
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    
    # Initialize extensions
    jwt = JWTManager(app)
    CORS(app)
    
    # Register blueprints
    from app.routes.credentials import credentials_bp
    from app.routes.deployments import deployments_bp
    
    app.register_blueprint(credentials_bp)
    app.register_blueprint(deployments_bp)
    
    return app

