from fastapi import FastAPI
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
from common.settings import settings
from controllers.app_router import app_router

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

handler = Mangum(app)

app.include_router(app_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.ENV}
