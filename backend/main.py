from fastapi import FastAPI

from configs import config
from api.router import router

app = FastAPI()
app.include_router(router)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=config.BACKEND_PORT)
