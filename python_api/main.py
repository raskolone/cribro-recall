from __future__ import annotations

import json
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data.json"


class Word(BaseModel):
    id: str
    term: str
    translation: str
    category: str
    created_at: str = Field(alias="createdAt")

    model_config = {"populate_by_name": True}


class SessionStats(BaseModel):
    total_words: int = Field(alias="totalWords")
    attempts: int
    correct_answers: int = Field(alias="correctAnswers")
    current_streak: int = Field(alias="currentStreak")
    accuracy: int

    model_config = {"populate_by_name": True}


class StorageModel(BaseModel):
    words: list[Word]
    stats: SessionStats


class CreateWordPayload(BaseModel):
    term: str = Field(min_length=1, max_length=100)
    translation: str = Field(min_length=1, max_length=120)
    category: Literal["daily", "travel", "food", "work"]


class QuizPayload(BaseModel):
    word_id: str = Field(alias="wordId")
    answer: str = Field(min_length=1, max_length=120)

    model_config = {"populate_by_name": True}


class QuizResult(BaseModel):
    correct: bool
    expected: str
    normalized_answer: str = Field(alias="normalizedAnswer")
    stats: SessionStats

    model_config = {"populate_by_name": True}


def normalize_text(value: str) -> str:
    without_accents = unicodedata.normalize("NFKD", value)
    ascii_only = without_accents.encode("ascii", "ignore").decode("ascii")
    cleaned = " ".join(ascii_only.lower().strip().split())
    return cleaned


def read_storage() -> StorageModel:
    if not DATA_PATH.exists():
        raise RuntimeError("python_api/data.json is missing")

    raw_data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return StorageModel.model_validate(raw_data)


def write_storage(storage: StorageModel) -> None:
    DATA_PATH.write_text(
        json.dumps(storage.model_dump(by_alias=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def calculate_accuracy(attempts: int, correct_answers: int) -> int:
    if attempts == 0:
        return 0
    return round((correct_answers / attempts) * 100)


app = FastAPI(
    title="Starter Vocabulary API",
    version="0.1.0",
    description="Minimalny backend do nauki FastAPI, JSON storage i logiki quizu.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/words", response_model=list[Word], response_model_by_alias=True)
def list_words() -> list[Word]:
    storage = read_storage()
    return storage.words


@app.post("/words", response_model=Word, response_model_by_alias=True)
def create_word(payload: CreateWordPayload) -> Word:
    storage = read_storage()

    new_word = Word(
        id=str(uuid4()),
        term=payload.term.strip(),
        translation=payload.translation.strip(),
        category=payload.category,
        createdAt=datetime.now(timezone.utc).isoformat(),
    )

    storage.words.insert(0, new_word)
    storage.stats.total_words = len(storage.words)
    write_storage(storage)
    return new_word


@app.get("/stats", response_model=SessionStats, response_model_by_alias=True)
def get_stats() -> SessionStats:
    storage = read_storage()
    storage.stats.total_words = len(storage.words)
    storage.stats.accuracy = calculate_accuracy(
        storage.stats.attempts,
        storage.stats.correct_answers,
    )
    write_storage(storage)
    return storage.stats


@app.post("/quiz/check", response_model=QuizResult, response_model_by_alias=True)
def check_answer(payload: QuizPayload) -> QuizResult:
    storage = read_storage()
    word = next((item for item in storage.words if item.id == payload.word_id), None)

    if word is None:
        raise HTTPException(status_code=404, detail="Word not found")

    expected = normalize_text(word.translation)
    normalized_answer = normalize_text(payload.answer)
    is_correct = normalized_answer == expected

    storage.stats.attempts += 1
    if is_correct:
        storage.stats.correct_answers += 1
        storage.stats.current_streak += 1
    else:
        storage.stats.current_streak = 0

    storage.stats.total_words = len(storage.words)
    storage.stats.accuracy = calculate_accuracy(
        storage.stats.attempts,
        storage.stats.correct_answers,
    )
    write_storage(storage)

    return QuizResult(
        correct=is_correct,
        expected=word.translation,
        normalizedAnswer=normalized_answer,
        stats=storage.stats,
    )