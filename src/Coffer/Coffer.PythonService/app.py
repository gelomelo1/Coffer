from pathlib import Path
import uuid

from fastapi import FastAPI, File, UploadFile, Body
import os
from dotenv import load_dotenv
from build_image_check_response import build_image_check_response
from config import DOTENV_PATH, OBJECT_DETECTION_THRESHOLD, SIMILARITY_THRESHOLD, TEST_UPLOAD_DIR
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


load_dotenv()

app = FastAPI()


@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}

@app.post("/image_check/test")
async def image_check(file: UploadFile = File(...)):
    try:

        object_detection_model, similarity_model, collection = initialize_models("1_detection.pt", "1_similarity_60.pt")

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
    collection_type_id: str,
    collection_id: str,
    file: UploadFile = File(...)):
    try:
        object_detection_model, similarity_model, collection = initialize_models(f"{collection_type_id}_detection.pt", find_file_containing(os.getenv("MODELS_PATH"), f"{collection_type_id}_similarity"))

        image_array = await uploadfile_to_numpy(file)

        results = object_detection_similarity_pipeline(
            yolo_model=object_detection_model,
            cnn_model=similarity_model,
            image_array=image_array,
            conf_threshold=OBJECT_DETECTION_THRESHOLD
            )
        
        response = build_image_check_response(
            results,
            vector_db_collection=collection,
            main_threshold=SIMILARITY_THRESHOLD,
            save_path=os.getenv("IMAGECHECK_TEMP_PATH"),
            metadata_filters=[("collection_id", collection_id)]
        )

        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/save_embeddings/{collection_id}")        
async def save_embeddings(
    collection_id: str,
    items: List[ItemIds] = Body(...)
):

    try:

        object_detection_model, similarity_model, collection = initialize_models()

        save_embeddings_to_vectordb(
            collection,
            collection_id,
            os.getenv("IMAGECHECK_TEMP_PATH"),
            items
        )

        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.delete("/delete_embeddings/{item_id}")        
async def save_embeddings(
    item_id: str,
):
    try:

        object_detection_model, similarity_model, collection = initialize_models()

        delete_embedding_from_vectordb(collection, item_id)

        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.delete("/delete_collection_embeddings/{collection_id}")        
async def save_embeddings(
    collection_id: str,
):
    try:

        object_detection_model, similarity_model, collection = initialize_models()

        delete_embeddings_from_vectordb(collection, collection_id)

        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}