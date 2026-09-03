import numpy as np
import torch

from model import FeedRanker


# ==========================================
# CONFIG
# ==========================================

MODEL_FILE = "data/feed_ranker.pt"

SCALER_FILE = "data/scaler.npy"


# ==========================================
# LOAD MODEL
# ==========================================

checkpoint = torch.load(
    MODEL_FILE,
    map_location="cpu"
)

input_size = checkpoint["input_size"]

model = FeedRanker(
    input_size=input_size
)

model.load_state_dict(
    checkpoint["model_state_dict"]
)

model.eval()


# ==========================================
# LOAD SCALER
# ==========================================

scaler = np.load(
    SCALER_FILE,
    allow_pickle=True
).item()


# ==========================================
# FUNCTION
# ==========================================

def predict_score(
    likes,
    comments,
    post_age_hours,
    is_following_author,
    source
):

    source_mapping = {
        "following": 0,
        "trending": 1,
        "exploration": 2
    }

    source_value = source_mapping[
        source
    ]


    # ------------------------------
    # Create feature vector
    # ------------------------------

    features = np.array([
        likes,
        comments,
        post_age_hours,
        is_following_author,
        source_value
    ], dtype=np.float32)


    # ------------------------------
    # Normalize
    # ------------------------------

    features = (
        features - scaler["mean"]
    ) / scaler["scale"]


    # ------------------------------
    # Convert to tensor
    # ------------------------------

    x = torch.tensor(
        features,
        dtype=torch.float32
    ).unsqueeze(0)


    # ------------------------------
    # Model prediction
    # ------------------------------

    with torch.no_grad():

        logit = model(x)

        probability = torch.sigmoid(
            logit
        )


    return probability.item()


# ==========================================
# TEST
# ==========================================

score = predict_score(
    likes=120,
    comments=10,
    post_age_hours=2.3,
    is_following_author=1,
    source="following"
)


print(
    f"Predicted engagement probability: "
    f"{score:.4f}"
)