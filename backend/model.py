import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from pathlib import Path

CLASS_NAMES = [
    "Melanocytic nevi",
    "Dermatofibroma",
    "Benign keratosis-like lesions",
    "Basal cell carcinoma",
    "Actinic keratoses",
    "Vascular lesions",
    "Melanoma",
]

MODEL_PATH = Path(__file__).parent / "model" / "model_resnet34.pth"

preprocess = transforms.Compose([
    transforms.Resize((450, 600)),
    transforms.ToTensor(),
])

_model = None


def get_model():
    global _model
    if _model is None:
        model = models.resnet34(weights=None)
        model.fc = nn.Linear(model.fc.in_features, len(CLASS_NAMES))
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
        model.eval()
        _model = model
    return _model


def predict(image: Image.Image) -> dict:
    tensor = preprocess(image.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        logits = get_model()(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    scores = {name: round(probs[i].item(), 4) for i, name in enumerate(CLASS_NAMES)}
    top_idx = probs.argmax().item()

    return {
        "prediction": CLASS_NAMES[top_idx],
        "confidence": round(probs[top_idx].item(), 4),
        "all_scores": scores,
    }
