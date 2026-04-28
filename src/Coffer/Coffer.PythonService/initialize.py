from ultralytics import YOLO
import torch
import os
from config import DEVICE, VECTOR_COLLECTION_NAME
from image_to_cnn_embedding import ResNetEmbeddingWithClassifier

def initialize_models(object_detection_model_name: str = None, similarity_model_name: str = None):

    object_detection_model = None
    similarity_model = None

    if object_detection_model_name:
        yolo_path = os.path.join(os.getenv("MODELS_PATH"), object_detection_model_name)
        similarity_path = os.path.join(os.getenv("MODELS_PATH"), similarity_model_name)

    if similarity_model_name:
        try:
            num_classes_str = similarity_model_name.rsplit("_", 1)[-1].replace(".pt", "")
            num_classes = int(num_classes_str)
        except ValueError:
            raise ValueError(f"Cannot extract num_classes from '{similarity_model_name}'")

        object_detection_model = YOLO(yolo_path)

        similarity_model = ResNetEmbeddingWithClassifier(num_classes=num_classes)

        state_dict = torch.load(similarity_path, map_location=DEVICE)
        similarity_model.load_state_dict(state_dict)

        similarity_model.to(DEVICE)
        similarity_model.eval()

    return object_detection_model, similarity_model