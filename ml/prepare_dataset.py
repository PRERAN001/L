import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler


# ==========================================
# CONFIG
# ==========================================

INPUT_FILE = "data/events.csv"

OUTPUT_FEATURES = "data/X.npy"
OUTPUT_LABELS = "data/y.npy"
OUTPUT_SCALER = "data/scaler.npy"


# ==========================================
# LOAD DATA
# ==========================================

df = pd.read_csv(INPUT_FILE)

print("Loaded Multi-Objective dataset head:")
print(df.head())

print("\nTotal events/samples:", len(df))


# ==========================================
# CONVERT SOURCE TO NUMBER
# ==========================================

source_mapping = {
    "following": 0,
    "trending": 1,
    "exploration": 2
}

if "source" in df.columns:
    df["source"] = df["source"].astype(str).map(source_mapping).fillna(0)

if "isFollowingAuthor" in df.columns and "isFollowing" not in df.columns:
    df["isFollowing"] = df["isFollowingAuthor"]


# ==========================================
# FEATURES (5 INPUTS)
# ==========================================

feature_columns = [
    "likes",
    "comments",
    "postAgeHours",
    "isFollowing",
    "source"
]

X = df[feature_columns].values.astype(np.float32)


# ==========================================
# MULTI-OBJECTIVE TARGET LABELS (4 OUTPUTS)
# [like, comment, share, view]
# ==========================================

target_columns = ["like", "comment", "share", "view"]

# If columns don't exist directly (legacy CSV format), construct them from eventType
if not all(col in df.columns for col in target_columns):
    df["like"] = (df["eventType"] == "like").astype(np.float32)
    df["comment"] = (df["eventType"] == "comment").astype(np.float32)
    df["share"] = (df["eventType"] == "share").astype(np.float32)
    df["view"] = (df["eventType"].isin(["view", "like", "comment", "save", "share"])).astype(np.float32)

y = df[target_columns].values.astype(np.float32)  # Shape: (N, 4)


# ==========================================
# NORMALIZE FEATURES
# ==========================================

scaler = StandardScaler()
X = scaler.fit_transform(X)


# ==========================================
# SAVE DATA
# ==========================================

np.save(OUTPUT_FEATURES, X)
np.save(OUTPUT_LABELS, y)

np.save(
    OUTPUT_SCALER,
    {
        "mean": scaler.mean_,
        "scale": scaler.scale_
    },
    allow_pickle=True
)


print("\nMulti-Objective Dataset Created Successfully.")
print("X shape (inputs):", X.shape)
print("y shape (targets: [like, comment, share, view]):", y.shape)

print("\nInput Features:", feature_columns)
print("Target Outcomes:", target_columns)

print("\nPositive Label Counts Per Objective:")
for idx, col in enumerate(target_columns):
    pos_count = int(y[:, idx].sum())
    total_count = len(y)
    print(f" - {col:8s}: {pos_count} positive / {total_count - pos_count} negative ({pos_count / total_count * 100:.1f}%)")