from fastapi import FastAPI, File, UploadFile
import os

from config import UPLOAD_DIR
from file_utils import save_dicts_to_txt, save_images, uploadfile_to_numpy
from initialize import lifespan
from object_detection_similarity_pipeline import object_detection_similarity_pipeline

# --- Create FastAPI app ---
app = FastAPI(lifespan=lifespan)


@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}

@app.post("/image_check")
async def image_check(file: UploadFile = File(...)):
    try:
        # Convert uploadfile to in-memory image
        image_array = await uploadfile_to_numpy(file)

        # Models for the detection, and embedding
        yolo_model = app.state.yolo_model
        cnn_model = app.state.cnn_model

        crops, embeddings, sims = object_detection_similarity_pipeline(
            yolo_model=yolo_model,
            cnn_model=cnn_model,
            image_array=image_array,
            conf_threshold=0.8
            )
        
        save_images(crops, UPLOAD_DIR)
        save_dicts_to_txt(embeddings, os.path.join(UPLOAD_DIR, "embeddings.txt"))
        save_dicts_to_txt(sims, os.path.join(UPLOAD_DIR, "similarities.txt"))

        # Here you could run validation, ML model, etc.
        # For now, just return a success message
        return {"status": "ok", "message": "Image received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}