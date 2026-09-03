import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader

from model import MultiObjectiveFeedRanker


# ==========================================
# CONFIG
# ==========================================

FEATURES_FILE = "data/X.npy"
LABELS_FILE = "data/y.npy"
MODEL_FILE = "data/feed_ranker.pt"

INPUT_SIZE = 5
OUTPUT_SIZE = 4  # 4 targets: like, comment, share, view

BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 0.001


# ==========================================
# LOAD DATA
# ==========================================

X = np.load(FEATURES_FILE)
y = np.load(LABELS_FILE)

X = torch.tensor(X, dtype=torch.float32)
y = torch.tensor(y, dtype=torch.float32)

print("Loaded features X shape:", X.shape)
print("Loaded target labels y shape:", y.shape)


# ==========================================
# DATASET & DATALOADER
# ==========================================

dataset = TensorDataset(X, y)
dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)


# ==========================================
# MODEL & LOSS & OPTIMIZER
# ==========================================

model = MultiObjectiveFeedRanker(input_size=INPUT_SIZE, output_size=OUTPUT_SIZE)

# BCEWithLogitsLoss combines Sigmoid layer and Binary Cross-Entropy Loss for multi-label targets
criterion = nn.BCEWithLogitsLoss()

optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)


# ==========================================
# TRAINING LOOP
# ==========================================

print("\nStarting Multi-Objective Training (5 inputs -> 4 outputs: like, comment, share, view)...")

for epoch in range(EPOCHS):
    total_loss = 0.0

    for batch_X, batch_y in dataloader:
        # 1. Forward pass (outputs 4 logits per sample)
        logits = model(batch_X)

        # 2. Calculate multi-objective loss across all 4 outputs
        loss = criterion(logits, batch_y)

        # 3. Clear gradients
        optimizer.zero_grad()

        # 4. Backward pass
        loss.backward()

        # 5. Update weights
        optimizer.step()

        total_loss += loss.item()

    average_loss = total_loss / len(dataloader)

    if (epoch + 1) % 5 == 0 or epoch == 0:
        print(f"Epoch [{epoch + 1:2d}/{EPOCHS}] - Loss: {average_loss:.4f}")


# ==========================================
# SAVE MODEL CHECKPOINT
# ==========================================

torch.save(
    {
        "model_state_dict": model.state_dict(),
        "input_size": INPUT_SIZE,
        "output_size": OUTPUT_SIZE,
        "target_names": ["like", "comment", "share", "view"]
    },
    MODEL_FILE
)

print(f"\nMulti-Objective Model saved successfully to: {MODEL_FILE}")