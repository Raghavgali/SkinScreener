# SkinScreener

AI-powered skin lesion analysis tool that detects, classifies, and visualizes skin lesion progression using deep learning and generative AI.

## Features

- **Lesion Detection** — YOLOv8 detects skin lesions and draws bounding boxes before classification
- **7-Class Classification** — ResNet34 classifies lesions into: Melanoma, Basal Cell Carcinoma, Actinic Keratoses, Melanocytic Nevi, Benign Keratosis, Vascular Lesions, Dermatofibroma
- **Visual Progression** — AI-generated before/after images showing how a lesion likely looked at origin and how it might progress if untreated (powered by Gemini 3.1 Flash Image)
- **Diagnosis History** — SQLite-backed diary of all analyses with images, timestamps, and predictions
- **Camera & Upload** — Capture images via webcam (with camera selector) or upload files
- **Explainability** — Severity badges, disease descriptions, and at-home care steps for each diagnosis

## Architecture

```
Camera/Upload → YOLO Detection → Lesion Found?
  Yes → Crop + Bounding Box → ResNet34 Classify → Results + History
  No  → "No lesion detected" error

Results → Generate Progression Images (Gemini API) → Before/After visualization
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Detection | YOLOv8 (ultralytics) |
| Classification | ResNet34 (PyTorch) |
| Image Generation | Gemini 3.1 Flash Image Preview |
| Database | SQLite (aiosqlite) |

## Project Structure

```
SkinScreener/
├── backend/
│   ├── main.py              # FastAPI app — predict, history, image gen endpoints
│   ├── model.py             # ResNet34 classifier (7 classes)
│   ├── detector.py          # YOLO lesion detection pipeline
│   ├── database.py          # SQLite async DB for diagnosis history
│   ├── requirements.txt
│   ├── .env.example         # Template for API keys
│   └── model/
│       ├── model_resnet34.pth   # Classification weights (not in repo)
│       └── lesion_yolo.pt       # YOLO detection weights (not in repo)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main app — analyze tab, results, image gen
│   │   ├── History.jsx      # Diagnosis history timeline
│   │   └── App.css          # All styles
│   └── package.json
└── notebooks/
    └── train_yolo_lesion_detector.ipynb  # Fine-tune YOLOv8 on skin lesions
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Backend

```bash
cd backend
python -m venv backend_venv
source backend_venv/bin/activate
pip install -r requirements.txt

# Add your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Place model files in backend/model/
# - model_resnet34.pth (classification)
# - lesion_yolo.pt (detection, optional)

uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Models

### Classification (ResNet34)

Trained on HAM10000 dataset with 7 skin lesion classes. Place `model_resnet34.pth` in `backend/model/`.

### Detection (YOLOv8)

Fine-tuned YOLOv8-nano for skin lesion localization. Use the training notebook in `notebooks/` to train your own, then place `lesion_yolo.pt` in `backend/model/`. The app works without it (skips detection and classifies the full image).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Upload image → detect + classify |
| GET | `/history` | List all past diagnoses |
| GET | `/history/{id}` | Full diagnosis detail with image |
| GET | `/history/{id}/image` | Raw image response |
| DELETE | `/history/{id}` | Delete a diagnosis record |
| POST | `/generate-images` | Generate before/after progression images |

## Disclaimer

This tool is for **educational purposes only** and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a dermatologist for skin concerns.

## License

MIT
