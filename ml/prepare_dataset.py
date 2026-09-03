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

print("Loaded events:")
print(df.head())

print("\nTotal events:", len(df))


# ==========================================
# CONVERT SOURCE TO NUMBER
# ==========================================

source_mapping = {
    "following": 0,
    "trending": 1,
    "exploration": 2
}

df["source"] = df["source"].map(source_mapping)


# ==========================================
# CREATE LABEL
# ==========================================

positive_events = {
    "like",
    "comment",
    "save",
    "share"
}

df["label"] = df["eventType"].apply(
    lambda event: 1 if event in positive_events else 0
)


# ==========================================
# FEATURES
# ==========================================

feature_columns = [
    "likes",
    "comments",
    "postAgeHours",
    "isFollowingAuthor",
    "source"
]

X = df[feature_columns].values.astype(np.float32)

y = df["label"].values.astype(np.float32)

y = y.reshape(-1, 1)


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


print("\nDataset created.")

print("X shape:", X.shape)

print("y shape:", y.shape)

print("\nFeatures:")
print(feature_columns)

print("\nPositive samples:", int(y.sum()))

print("Negative samples:", int(len(y) - y.sum()))