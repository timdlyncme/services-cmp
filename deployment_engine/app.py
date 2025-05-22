from fastapi import FastAPI, HTTPException  
from deployment.azure_deployer import AzureDeployer  

app = FastAPI()  
deployer = AzureDeployer()  

@app.post("/deployments/")  
async def deploy_template(template_id: str, environment: str):  
    try:  
        result = deployer.deploy(environment, template_id)  
        return result  
    except Exception as e:  
        raise HTTPException(status_code=500, detail=str(e))  

if __name__ == "__main__":  
    import uvicorn  
    uvicorn.run(app, host="0.0.0.0", port=5000)