from ultralytics import YOLO
from PIL import Image, ImageDraw
from pathlib import Path
import io
import base64

YOLO_PATH = Path(__file__).parent / "model" / "lesion_yolo.pt"

_detector = None


def get_detector():
    global _detector
    if _detector is None:
        if not YOLO_PATH.exists():
            return None
        _detector = YOLO(str(YOLO_PATH))
    return _detector


def detect_lesions(image: Image.Image, conf_threshold: float = 0.25) -> dict:
    """
    Run YOLO on the image. Returns:
    {
        "found": bool,
        "detections": [{"bbox": [x1,y1,x2,y2], "confidence": float}, ...],
        "cropped_images": [PIL.Image, ...],        # cropped lesion regions
        "annotated_image_b64": str,                 # full image with bboxes drawn
    }
    """
    detector = get_detector()
    if detector is None:
        # No YOLO model available — skip detection, pass full image through
        return {
            "found": True,
            "detections": [],
            "cropped_images": [image],
            "annotated_image_b64": None,
            "skipped": True,
        }

    results = detector(image, conf=conf_threshold, verbose=False)
    boxes = results[0].boxes

    # Sort by confidence (highest first) — we only use YOLO for localization, not classification
    if len(boxes) > 0:
        sorted_indices = boxes.conf.argsort(descending=True)
        boxes = boxes[sorted_indices]

    if len(boxes) == 0:
        return {
            "found": False,
            "detections": [],
            "cropped_images": [],
            "annotated_image_b64": None,
        }

    detections = []
    cropped_images = []
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = box.conf[0].item()
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

        detections.append({
            "bbox": [x1, y1, x2, y2],
            "confidence": round(conf, 4),
        })

        # Crop with generous padding (20% of bbox size) to preserve context
        # HAM10000 images have significant skin context around lesions
        bw, bh = x2 - x1, y2 - y1
        pad_x = int(bw * 0.2)
        pad_y = int(bh * 0.2)
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(image.width, x2 + pad_x)
        cy2 = min(image.height, y2 + pad_y)

        # If bbox covers >70% of image, use full image (already a close-up)
        bbox_area = bw * bh
        img_area = image.width * image.height
        if bbox_area / img_area > 0.7:
            cropped_images.append(image)
        else:
            cropped_images.append(image.crop((cx1, cy1, cx2, cy2)))

        # Draw bounding box
        draw.rectangle([x1, y1, x2, y2], outline="#3b82f6", width=3)
        draw.text((x1 + 4, y1 + 4), f"{conf:.0%}", fill="#3b82f6")

    # Encode annotated image
    buf = io.BytesIO()
    annotated.save(buf, format="PNG")
    annotated_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "found": True,
        "detections": detections,
        "cropped_images": cropped_images,
        "annotated_image_b64": annotated_b64,
    }
