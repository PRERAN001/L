from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

app = FastAPI(title="Embedding Service", version="1.0")

# Load once at startup — all-MiniLM-L6-v2 produces 384-dim vectors
model = SentenceTransformer("all-MiniLM-L6-v2")


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    dim: int


@app.get("/health")
def health():
    return {"status": "ok", "model": "all-MiniLM-L6-v2", "dim": 384}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    text = req.text.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="text must be a non-empty string"
        )

    embedding = model.encode(text, normalize_embeddings=True)

    return EmbedResponse(
        embedding=embedding.tolist(),
        dim=len(embedding)
    )


if __name__ == "__main__":
    uvicorn.run("embed:app", host="0.0.0.0", port=8000, reload=False)
