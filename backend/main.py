from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from backend.analyzer.pipeline import run_pipeline_request
from backend.collector.normalize import (
    build_and_save_normalized_bundle,
    build_normalized_bundle,
)
from backend.http_contracts import pipeline_status_code
from backend.routes.dev_auth_routes import router as dev_auth_router
from backend.routes.dev_data_routes import router as dev_data_router
from backend.routes.disclosure_routes import router as disclosure_router
from backend.routes.external_api_routes import router as external_api_router
from backend.routes.pipeline_routes import router as pipeline_router
from backend.routes.qa_routes import router as qa_router
from backend.routes.report_routes import create_report_response
from backend.storage.connection import get_repository_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_repository_provider()
    yield


app = FastAPI(title="Gongsiri A Data Pipeline", lifespan=lifespan)
app.include_router(dev_auth_router)
app.include_router(dev_data_router)
app.include_router(disclosure_router)
app.include_router(external_api_router)
app.include_router(pipeline_router)
app.include_router(qa_router)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "gongsiri-a-pipeline",
    }


@app.get("/bundle/{keyword}")
def get_bundle(keyword: str):
    try:
        bundle = build_normalized_bundle(keyword)
        return bundle.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/bundle/{keyword}/save")
def save_bundle(keyword: str):
    try:
        result = build_and_save_normalized_bundle(keyword)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analysis/pipeline")
def run_analysis_pipeline(request: dict[str, Any]):
    response = run_pipeline_request(request, trace_id=request.get("traceId"))
    return JSONResponse(content=response, status_code=pipeline_status_code(response))


@app.post("/api/v1/reports")
async def create_report(request: Request):
    return await create_report_response(request)
