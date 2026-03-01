import aiosqlite
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / "skinscreener.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS diagnoses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                image_blob BLOB NOT NULL,
                prediction TEXT NOT NULL,
                confidence REAL NOT NULL,
                all_scores TEXT NOT NULL,
                notes TEXT DEFAULT ''
            )
        """)
        await db.commit()


async def save_diagnosis(image_bytes: bytes, prediction: str, confidence: float, all_scores: dict, notes: str = "") -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO diagnoses (created_at, image_blob, prediction, confidence, all_scores, notes) VALUES (?, ?, ?, ?, ?, ?)",
            (datetime.utcnow().isoformat(), image_bytes, prediction, confidence, json.dumps(all_scores), notes),
        )
        await db.commit()
        return cursor.lastrowid


async def get_all_diagnoses() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await db.execute_fetchall(
            "SELECT id, created_at, prediction, confidence, all_scores, notes FROM diagnoses ORDER BY id DESC"
        )
        return [
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "prediction": r["prediction"],
                "confidence": r["confidence"],
                "all_scores": json.loads(r["all_scores"]),
                "notes": r["notes"],
            }
            for r in rows
        ]


async def get_diagnosis(diagnosis_id: int) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM diagnoses WHERE id = ?", (diagnosis_id,))
        r = await cursor.fetchone()
        if not r:
            return None
        return {
            "id": r["id"],
            "created_at": r["created_at"],
            "image_blob": r["image_blob"],
            "prediction": r["prediction"],
            "confidence": r["confidence"],
            "all_scores": json.loads(r["all_scores"]),
            "notes": r["notes"],
        }


async def delete_diagnosis(diagnosis_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("DELETE FROM diagnoses WHERE id = ?", (diagnosis_id,))
        await db.commit()
        return cursor.rowcount > 0
