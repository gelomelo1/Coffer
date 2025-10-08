from fastapi import FastAPI, File, UploadFile
import os
from datetime import datetime

app = FastAPI()


UPLOAD_DIR = "E:\\Homework\\Programming\\AI\\szakdolgozat\\apitest"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/hello")
async def say_hello():
    return {"message" : "Hello from Python FastAPI"}

@app.post("/image_check")
async def image_check(file: UploadFile = File(...)):
    try:
        # Save the uploaded image to the uploads folder
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Here you could run validation, ML model, etc.
        # For now, just return a success message
        return {"status": "ok", "message": "Image received", "filename": filename}
    except Exception as e:
        return {"status": "error", "message": str(e)}