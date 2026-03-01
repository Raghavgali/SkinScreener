from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image
import base64
import io
import os

from google import genai
from google.genai import types

from model import predict, MODEL_PATH
from detector import detect_lesions
from database import init_db, save_diagnosis, get_all_diagnoses, get_diagnosis, delete_diagnosis

app = FastAPI(title="SkinScreener API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    if not MODEL_PATH.exists():
        raise HTTPException(503, "Model file not found. Place model_resnet34.pth in backend/model/")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    # Step 1: Detect lesions with YOLO
    detection = detect_lesions(image)

    if not detection["found"]:
        raise HTTPException(
            422,
            "No skin lesion detected in this image. Please capture a closer image of the lesion.",
        )

    # Step 2: Classify the best (highest confidence) cropped lesion
    cropped = detection["cropped_images"][0]
    result = predict(cropped)

    # Step 3: Include detection metadata
    result["annotated_image"] = detection.get("annotated_image_b64")
    result["detections"] = detection.get("detections", [])
    result["detection_skipped"] = detection.get("skipped", False)

    # Step 4: Save to history (store the original image)
    diagnosis_id = await save_diagnosis(
        image_bytes=contents,
        prediction=result["prediction"],
        confidence=result["confidence"],
        all_scores=result["all_scores"],
    )
    result["id"] = diagnosis_id
    return result


# --- History endpoints ---

@app.get("/history")
async def list_history():
    return await get_all_diagnoses()


@app.get("/history/{diagnosis_id}")
async def get_history_detail(diagnosis_id: int):
    record = await get_diagnosis(diagnosis_id)
    if not record:
        raise HTTPException(404, "Diagnosis not found")
    image_b64 = base64.b64encode(record.pop("image_blob")).decode()
    record["image_base64"] = image_b64
    return record


@app.get("/history/{diagnosis_id}/image")
async def get_history_image(diagnosis_id: int):
    record = await get_diagnosis(diagnosis_id)
    if not record:
        raise HTTPException(404, "Diagnosis not found")
    return Response(content=record["image_blob"], media_type="image/jpeg")


@app.delete("/history/{diagnosis_id}")
async def delete_history(diagnosis_id: int):
    deleted = await delete_diagnosis(diagnosis_id)
    if not deleted:
        raise HTTPException(404, "Diagnosis not found")
    return {"status": "deleted"}


# --- Image generation endpoint ---

class GenerateImagesRequest(BaseModel):
    diagnosis_id: int


@app.post("/generate-images")
async def generate_images(req: GenerateImagesRequest):
    record = await get_diagnosis(req.diagnosis_id)
    if not record:
        raise HTTPException(404, "Diagnosis not found")

    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GEMINI_API_KEY environment variable not set")

    client = genai.Client(api_key=api_key)
    prediction = record["prediction"]
    image_bytes = record["image_blob"]

    model = "gemini-3.1-flash-image-preview"
    gen_config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
    )
    results = {}

    # Build the image part from the stored upload
    image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

    def extract_image_b64(response) -> str | None:
        for part in response.parts:
            if part.inline_data is not None:
                return base64.b64encode(part.inline_data.data).decode()
        return None

    # Origin image
    try:
        origin_resp = client.models.generate_content(
            model=model,
            contents=[
                image_part,
                types.Part.from_text(
                    text=(
                        f"This is a photo of a skin lesion diagnosed as {prediction}. "
                        f"Edit this exact image to show how this specific lesion likely looked at its very earliest stage — "
                        f"smaller, flatter, less pigmented, just beginning to appear. "
                        f"Keep the same skin tone, same body location, same lighting, same background. "
                        f"Only modify the lesion itself to make it look earlier/younger. Generate the edited image."
                    )
                ),
            ],
            config=gen_config,
        )
        b64 = extract_image_b64(origin_resp)
        if b64:
            results["origin_image"] = b64
        else:
            results["origin_error"] = "No image generated"
    except Exception as e:
        results["origin_error"] = str(e)

    # Progression image
    try:
        prog_resp = client.models.generate_content(
            model=model,
            contents=[
                image_part,
                types.Part.from_text(
                    text=(
                        f"This is a photo of a skin lesion diagnosed as {prediction}. "
                        f"Edit this exact image to show how this specific lesion might look if left completely untreated for 6-12 months — "
                        f"larger, darker, more irregular borders, more raised or textured. "
                        f"Keep the same skin tone, same body location, same lighting, same background. "
                        f"Only modify the lesion itself to make it look more advanced. Generate the edited image."
                    )
                ),
            ],
            config=gen_config,
        )
        b64 = extract_image_b64(prog_resp)
        if b64:
            results["progression_image"] = b64
        else:
            results["progression_error"] = "No image generated"
    except Exception as e:
        results["progression_error"] = str(e)

    return results
