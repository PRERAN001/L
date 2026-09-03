import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from torch.utils.data import TensorDataset, DataLoader

from model import FeedRanker


# ==========================================
# CONFIG
# ==========================================

FEATURES_FILE = "data/X.npy"
LABELS_FILE = "data/y.npy"

MODEL_FILE = "data/feed_ranker.pt"

INPUT_SIZE = 5

BATCH_SIZE = 64

EPOCHS = 50

LEARNING_RATE = 0.001


# ==========================================
# LOAD DATA
# ==========================================

X = np.load(FEATURES_FILE)

y = np.load(LABELS_FILE)


# ==========================================
# CONVERT TO PYTORCH TENSORS
# ==========================================

X = torch.tensor(
    X,
    dtype=torch.float32
)

y = torch.tensor(
    y,
    dtype=torch.float32
)


print("X:", X.shape)

print("y:", y.shape)


# ==========================================
# DATASET
# ==========================================

dataset = TensorDataset(
    X,
    y
)


# ==========================================
# DATALOADER
# ==========================================

dataloader = DataLoader(
    dataset,
    batch_size=BATCH_SIZE,
    shuffle=True
)


# ==========================================
# MODEL
# ==========================================

model = FeedRanker(
    input_size=INPUT_SIZE
)


# ==========================================
# LOSS
# ==========================================

criterion = nn.BCEWithLogitsLoss()


# ==========================================
# OPTIMIZER
# ==========================================

optimizer = optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE
)


# ==========================================
# TRAINING
# ==========================================

for epoch in range(EPOCHS):

    total_loss = 0.0

    for batch_X, batch_y in dataloader:

        # ----------------------------------
        # 1. FORWARD PASS
        # ----------------------------------

        logits = model(batch_X)


        # ----------------------------------
        # 2. CALCULATE LOSS
        # ----------------------------------

        loss = criterion(
            logits,
            batch_y
        )


        # ----------------------------------
        # 3. CLEAR OLD GRADIENTS
        # ----------------------------------

        optimizer.zero_grad()


        # ----------------------------------
        # 4. BACKPROPAGATION
        # ----------------------------------

        loss.backward()


        # ----------------------------------
        # 5. UPDATE PARAMETERS
        # ----------------------------------

        optimizer.step()


        total_loss += loss.item()


    average_loss = (
        total_loss /
        len(dataloader)
    )


    print(
        f"Epoch {epoch + 1}/{EPOCHS} "
        f"Loss: {average_loss:.4f}"
    )


# ==========================================
# SAVE MODEL
# ==========================================

torch.save(
    {
        "model_state_dict": model.state_dict(),
        "input_size": INPUT_SIZE
    },
    MODEL_FILE
)


print("\nModel saved to:")
print(MODEL_FILE)