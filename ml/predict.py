import numpy as np
import torch
import json
from model import MultiObjectiveFeedRanker

# ==========================================
# CONFIG
# ==========================================

MODEL_FILE = "data/feed_ranker.pt"
SCALER_FILE = "data/scaler.npy"

# ==========================================
# LOAD MODEL & SCALER
# ==========================================

checkpoint = torch.load(MODEL_FILE, map_location="cpu")
input_size = checkpoint.get("input_size", 5)
output_size = checkpoint.get("output_size", 4)
target_names = checkpoint.get("target_names", ["like", "comment", "share", "view"])

model = MultiObjectiveFeedRanker(input_size=input_size, output_size=output_size)
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

scaler = np.load(SCALER_FILE, allow_pickle=True).item()


# ==========================================
# MULTI-OBJECTIVE PREDICTION FUNCTION
# ==========================================

def predict_multi_objective(
    likes,
    comments,
    post_age_hours,
    is_following,
    source,
    user_id=None,
    post_id=None,
    weights=None
):
    """
    Predicts 4 multi-objective probabilities (like, comment, share, view)
    and computes a weighted expectation score for feed reranking.
    """

    source_mapping = {
        "following": 0,
        "trending": 1,
        "exploration": 2
    }

    source_value = source_mapping.get(source, 0) if isinstance(source, str) else source

    # 1. Input feature vector (5 inputs)
    features = np.array([
        likes,
        comments,
        post_age_hours,
        is_following,
        source_value
    ], dtype=np.float32)

    # 2. Normalize features using dataset scaler
    features_scaled = (features - scaler["mean"]) / scaler["scale"]

    # 3. Convert to PyTorch tensor
    x = torch.tensor(features_scaled, dtype=torch.float32).unsqueeze(0)

    # 4. Multi-Objective Model Inference
    with torch.no_grad():
        logits = model(x) # Output shape: (1, 4)
        probs = torch.sigmoid(logits).squeeze(0).numpy()

    p_like = float(probs[0])
    p_comment = float(probs[1])
    p_share = float(probs[2])
    p_view = float(probs[3])

    # Default multi-objective value weights for feed reranking
    default_weights = {
        "like": 15.0,
        "comment": 25.0,
        "share": 35.0,
        "view": 5.0
    }
    w = weights if weights else default_weights

    # Multi-Objective expected value score for feed reranking
    rerank_score = (
        p_like * w.get("like", 15.0) +
        p_comment * w.get("comment", 25.0) +
        p_share * w.get("share", 35.0) +
        p_view * w.get("view", 5.0)
    )

    return {
        "userId": user_id,
        "postId": post_id,
        "predictions": {
            "like": round(p_like, 4),
            "comment": round(p_comment, 4),
            "share": round(p_share, 4),
            "view": round(p_view, 4),
        },
        "multiObjectiveScore": round(rerank_score, 4)
    }


if __name__ == "__main__":
    print("--- MULTI-OBJECTIVE PREDICTION DEMO ---")
    
    # Test case matching user request:
    # userId: U123, postId: P456, likes: 120, comments: 14, postAgeHours: 2.3, isFollowing: 1, source: following
    sample_result = predict_multi_objective(
        user_id="U123",
        post_id="P456",
        likes=120,
        comments=14,
        post_age_hours=2.3,
        is_following=1,
        source="following"
    )

    print(json.dumps(sample_result, indent=2))