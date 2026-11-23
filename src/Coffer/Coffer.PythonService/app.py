from pathlib import Path
import hmac
import re
import numpy as np
import uuid
from fastapi import FastAPI, File, Request, UploadFile, Body
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from fastapi.concurrency import asynccontextmanager
from build_image_check_response import build_image_check_response
from config import DOTENV_PATH, LEGACY_THRESHOLDS, TEST_UPLOAD_DIR, VECTOR_COLLECTION_NAME, VECTOR_DIMENSION
from reembed import reembed
from coffer_models import load_detection_model, load_embedding_model
from model_cache import ModelCache
from delete_embedding_from_vectordb import delete_embedding_from_vectordb
from delete_embeddings_from_vectordb import delete_embeddings_from_vectordb
from file_utils import save_dicts_to_txt, save_images, similarity_model_file, uploadfile_to_numpy
from itemids import ItemIds
from object_detection_similarity_pipeline import object_detection_similarity_pipeline
from object_detection_similarity_pipeline_test import object_detection_similarity_pipeline_test
from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional
from save_embeddings_to_vectordb import save_embeddings_to_vectordb
from pending import pending_folder, pending_similars, save_pending_embedding
import chromadb
from vector_store import open_cosine_collection


load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.vector_db = chromadb.PersistentClient(
        os.getenv("VECTORSTORE_PATH")
    )
    print("vector_db initialized:", app.state.vector_db)

    app.state.collection = open_cosine_collection(app.state.vector_db, VECTOR_COLLECTION_NAME)
    print(f"Collection '{VECTOR_COLLECTION_NAME}' ready.")

    yield

    print("Shutting down...")

app = FastAPI(lifespan=lifespan)

INTERNAL_API_KEY_HEADER = "X-Internal-Api-Key"

MODELS = ModelCache()
MODEL_FILE = re.compile(r"^[0-9]+_(detection|similarity_[0-9]+)\.pt(\.candidate)?$")


def type_models(collection_type_id: int):
    """The item type's detection and embedding models (loaded once, reloaded when a file changes)."""
    folder = os.getenv("MODELS_PATH")
    detection_path = os.path.join(folder, f"{int(collection_type_id)}_detection.pt")
    embedding_name = similarity_model_file(folder, collection_type_id)
    if embedding_name is None or not os.path.exists(detection_path):
        raise FileNotFoundError(f"Item type {collection_type_id} has no detection or embedding model")
    return MODELS.detection(detection_path), MODELS.embedding(os.path.join(folder, embedding_name))


def type_thresholds(collection_type_id: Optional[int]) -> dict:
    """The embedding thresholds of the item type's model; the legacy ones without a type or model."""
    folder = os.getenv("MODELS_PATH")
    if collection_type_id is None or not folder or not os.path.isdir(folder):
        return dict(LEGACY_THRESHOLDS)
    name = similarity_model_file(folder, collection_type_id)
    return MODELS.embedding(os.path.join(folder, name)).thresholds if name else dict(LEGACY_THRESHOLDS)


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
async def image_check_test(file: UploadFile = File(...)):
    try:
        detection, embedding = type_models(1)
        image_array = await uploadfile_to_numpy(file)
        crops, embeddings, sims = object_detection_similarity_pipeline_test(detection, embedding, image_array)

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
        detection, embedding = type_models(collection_type_id)

        image_array = await uploadfile_to_numpy(file)

        results = object_detection_similarity_pipeline(detection, embedding, image_array)

        response = build_image_check_response(
            results,
            vector_db_collection=app.state.collection,
            thresholds=embedding.thresholds,
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
async def pending_similars_route(collection_id: UUID, body: PendingIds, type_id: Optional[int] = None):
    """Matches for waiting caps, from their stored fingerprints, with the thresholds of the item type's model."""
    try:
        response = pending_similars(app.state.collection, str(collection_id), pending_folder(), [str(i) for i in body.ids], type_thresholds(type_id))
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


class ValidateModel(BaseModel):
    fileName: str
    kind: str


@app.post("/models/validate")
async def validate_model(body: ValidateModel):
    """Loads a model file the backend just received and runs one blank image through it. A model the service
    cannot use is refused here, before it replaces the live one."""
    match = MODEL_FILE.match(body.fileName or "")
    expected = None if match is None else ("detection" if match.group(1) == "detection" else "embedding")
    if expected is None or body.kind != expected:
        return JSONResponse(status_code=422, content={"status": "error", "message": "not a model file of that kind"})
    path = os.path.join(os.getenv("MODELS_PATH", ""), body.fileName)
    probe = np.zeros((64, 64, 3), dtype=np.uint8)
    try:
        if expected == "embedding":
            model = load_embedding_model(path)
            model.embed(probe)
            if int(model.meta.get("embedding_dim", 256)) != VECTOR_DIMENSION:
                return JSONResponse(status_code=422, content={"status": "error", "message":
                    f"The model makes {model.meta.get('embedding_dim')}-number fingerprints; the vector store holds {VECTOR_DIMENSION}."})
        else:
            load_detection_model(path).detect(probe)
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse(status_code=422, content={"status": "error", "message": f"{type(e).__name__}: {e}"})


class ReembedItem(BaseModel):
    id: UUID
    collectionId: UUID
    image: str


class ReembedPending(BaseModel):
    id: UUID
    image: str


class ReembedBody(BaseModel):
    items: List[ReembedItem] = []
    pending: List[ReembedPending] = []


@app.post("/reembed/{collection_type_id}")
async def reembed_route(collection_type_id: int, body: ReembedBody):
    """The item type has a new embedding model: rebuild every fingerprint of its items and waiting caps with it."""
    try:
        folder = os.getenv("MODELS_PATH")
        name = similarity_model_file(folder, collection_type_id) if folder and os.path.isdir(folder) else None
        if name is None:
            raise FileNotFoundError(f"Item type {collection_type_id} has no embedding model")
        model = MODELS.embedding(os.path.join(folder, name))
        counts = reembed(app.state.collection, model, os.getenv("IMAGESTORE_PATH", ""),
                         [{"id": str(i.id), "collectionId": str(i.collectionId), "image": i.image} for i in body.items],
                         [{"id": str(p.id), "image": p.image} for p in body.pending])
        return {"status": "ok", **counts}
    except Exception as e:
        return error_response(e)
