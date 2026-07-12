from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import logging

# Import routers
from routes.baza_wiedzy import router as baza_wiedzy_router


# Create the main app
app = FastAPI(
    title="FireFighter Helper Backend",
    description="API for the Baza Wiedzy scraper.",
    version="1.0.0"
)

# Include the router in the main app
app.include_router(baza_wiedzy_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
