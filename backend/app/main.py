from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.seed import seed_database
from app.routers import (
    examinations, subjects, topics, syllabus,
    preparation, revisions, dashboard, backup_export
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    # Seed initial demo data
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="NEURO//TREE Academic Knowledge & Skill Tree API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(examinations.router, prefix="/api")
app.include_router(subjects.router, prefix="/api")
app.include_router(topics.router, prefix="/api")
app.include_router(syllabus.router, prefix="/api")
app.include_router(preparation.router, prefix="/api")
app.include_router(revisions.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(backup_export.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "NEURO//TREE Core",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
