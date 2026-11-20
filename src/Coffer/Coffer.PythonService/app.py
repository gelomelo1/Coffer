from pathlib import Path
import hmac
import uuid
from fastapi import FastAPI, File, Request, UploadFile, Body
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from fastapi.concurrency import asynccontextmanager
from build_image_check_response import build_image_check_response
from config import DOTENV_PATH, OBJECT_DETECTION_THRESHOLD, SIMILARITY_THRESHOLD, TEST_UPLOAD_DIR, VECTOR_COLLECTION_NAME
from delete_embedding_from_vectordb import delete_embedding_from_vectordb
from delete_embeddings_from_vectordb import delete_embeddings_from_vectordb
from file_utils import find_file_containing, save_dicts_to_txt, save_images, uploadfile_to_numpy
from initialize import initialize_models
from itemids import ItemIds
from object_detection_similarity_pipeline import object_detection_similarity_pipeline
from object_detection_similarity_pipeline_test import object_detection_similarity_pipeline_test
from pydantic import BaseModel
from uuid import UUID
from typing import List
from save_embeddings_to_vectordb import save_embeddings_to_vectordb
from pending import pending_folder, pending_similars, save_pending_embedding
import chromadb


load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.vector_db = chromadb.PersistentClient(
        os.getenv("VECTORSTORE_PATH")
    )
    print("vector_db initialized:", app.state.vector_db)

    app.state.collection = app.state.vector_db.get_or_create_collection(
        name=VECTOR_COLLECTION_NAME
    )
    print(f"Collection '{VECTOR_COLLECTION_NAME}' ready.")

    yield

    print("Shutting down...")

app = FastAPI(lifespan=lifespan)

INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"


@app.middleware("http")
async def require_internal_api_key(request: Request, call_next):
    """Only the ASP.NET backend may call this service. When INTERNAL_API_KEY is set (same value in the
    backend's environment), every request must carry it; when it is not set the previous behaviour stays."""
    expected = os.getenv("INTERNAL_API_KEY")
    if expected:
        provided = request.headers.get(INTERNAL_API_KEY_HEADER, "")
        if not hmac.compare_digest(provided.encode(), expected.encode()):
            return JSONResponse(status_code=401, content={"status": "error", "message": "unauthorized"})
    return await call_next(request)


def error_response(e: Exception) -> JSONResponse:
    """Failures of state-changing calls must not be reported as HTTP 200: the backend commits or rolls
    back its database transaction based on this response."""
    return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})


@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}

@app.post("/image_check/test")
async def image_check(file: UploadFile = File(...)):
    try:

        object_detection_model, similarity_model = initialize_models("1_detection.pt", "1_similarity_60.pt")

        image_array = await uploadfile_to_numpy(file)

        crops, embeddings, sims = object_detection_similarity_pipeline_test(
            yolo_model=object_detection_model,
            cnn_model=similarity_model,
            image_array=image_array,
            conf_threshold=0.9
            )
        
        save_images(crops, TEST_UPLOAD_DIR)
        save_dicts_to_txt(embeddings, os.path.join(TEST_UPLOAD_DIR, "embeddings.txt"))
        save_dicts_to_txt(sims, os.path.join(TEST_UPLOAD_DIR, "similarities.txt"))

        return {"status": "ok", "message": "Image received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.post("/image_check/{collection_type_id}/{collection_id}")
async def image_check(
    collection_type_id: int,
    collection_id: UUID,
    file: UploadFile = File(...)):
    collection_id = str(collection_id)
    try:
        object_detection_model, similarity_model = initialize_models(f"{collection_type_id}_detection.pt", find_file_containing(os.getenv("MODELS_PATH"), f"{collection_type_id}_similarity"))

        image_array = await uploadfile_to_numpy(file)

        results = object_detection_similarity_pipeline(
            yolo_model=object_detection_model,
            cnn_model=similarity_model,
            image_array=image_array,
            conf_threshold=OBJECT_DETECTION_THRESHOLD
            )
        
        response = build_image_check_response(
            results,
            vector_db_collection=app.state.collection,
            main_threshold=SIMILARITY_THRESHOLD,
            save_path=os.getenv("IMAGECHECK_TEMP_PATH"),
            metadata_filters=[("collection_id", collection_id)]
        )

        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/save_embeddings/{collection_id}")        
async def save_embeddings(
    collection_id: UUID,
    items: List[ItemIds] = Body(...)
):
    collection_id = str(collection_id)

    try:

        save_embeddings_to_vectordb(
            app.state.collection,
            collection_id,
            os.getenv("IMAGECHECK_TEMP_PATH"),
            items
        )

        return {"status": "ok"}
    except Exception as e:
        return error_response(e)
    
@app.delete("/delete_embeddings/{item_id}")        
async def delete_embeddings(
    item_id: UUID,
):
    item_id = str(item_id)
    try:

        delete_embedding_from_vectordb(app.state.collection, item_id)

        return {"status": "ok"}
    except Exception as e:
        return error_response(e)
    
@app.delete("/delete_collection_embeddings/{collection_id}")        
async def delete_collection_embeddings(
    collection_id: UUID,
):
    collection_id = str(collection_id)
    try:

        delete_embeddings_from_vectordb(app.state.collection, collection_id)

        return {"status": "ok"}
    except Exception as e:
        return error_response(e)


class PendingIds(BaseModel):
    ids: List[UUID]


class PendingEmbedding(BaseModel):
    pendingId: UUID
    itemId: UUID


@app.post("/pending_similars/{collection_id}")
async def pending_similars_route(collection_id: UUID, body: PendingIds):
    """Matches for waiting caps, from their stored fingerprints."""
    try:
        response = pending_similars(app.state.collection, str(collection_id), pending_folder(), [str(i) for i in body.ids])
        return {"status": "ok", "response": response}
    except Exception as e:
        return error_response(e)


@app.post("/save_pending_embedding/{collection_id}")
async def save_pending_embedding_route(collection_id: UUID, body: PendingEmbedding):
    """A waiting cap was added as a new item: keep its fingerprint for future matches."""
    try:
        save_pending_embedding(app.state.collection, str(collection_id), pending_folder(), str(body.pendingId), str(body.itemId))
        return {"status": "ok"}
    except Exception as e:
        return error_response(e)
