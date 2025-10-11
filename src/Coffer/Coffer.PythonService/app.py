from fastapi import FastAPI, File, UploadFile
import os
from dotenv import load_dotenv
from build_image_check_response import build_image_check_response
from config import DOTENV_PATH, OBJECT_DETECTION_THRESHOLD, SIMILARITY_THRESHOLD, TEST_UPLOAD_DIR
from file_utils import find_file_containing, save_dicts_to_txt, save_images, uploadfile_to_numpy
from initialize import initialize_models
from object_detection_similarity_pipeline import object_detection_similarity_pipeline
from object_detection_similarity_pipeline_test import object_detection_similarity_pipeline_test


load_dotenv(DOTENV_PATH)

# --- Create FastAPI app ---
app = FastAPI()


@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}

@app.post("/image_check/test")
async def image_check(file: UploadFile = File(...)):
    try:

        object_detection_model, similarity_model, collection = initialize_models("1_detection.pt", "1_similarity_60.pt")

        # Convert uploadfile to in-memory image
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

        # Here you could run validation, ML model, etc.
        # For now, just return a success message
        return {"status": "ok", "message": "Image received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.post("/image_check/{collectionTypeId}/{collectionId}")
async def image_check(
    collectionTypeId: str,
    collectionId: str,
    file: UploadFile = File(...)):
    try:

        object_detection_model, similarity_model, collection = initialize_models(f"{collectionTypeId}_detection.pt", find_file_containing(os.getenv("MODELS_PATH"), f"{collectionTypeId}_similarity"))

        # Convert uploadfile to in-memory image
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
            metadata_filters=[("collection_id", collectionId)]
        )

        # Here you could run validation, ML model, etc.
        # For now, just return a success message
        return {"status": "ok", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}