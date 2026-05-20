from fastapi import FastAPI, HTTPException

from backend.collector.normalize import (
    build_and_save_normalized_bundle,
    build_normalized_bundle,
)

app = FastAPI(title="Gongsiri A Data Pipeline")


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
