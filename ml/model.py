import torch
import torch.nn as nn


class FeedRanker(nn.Module):

    def __init__(self, input_size):
        super().__init__()

        self.network = nn.Sequential(        
            nn.Linear(input_size, 256),
            nn.ReLU(),     
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )

    def forward(self, x):
        return self.network(x)