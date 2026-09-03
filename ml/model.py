import torch
import torch.nn as nn


class MultiObjectiveFeedRanker(nn.Module):
    """
    Multi-Objective Feed Ranker Neural Network.
    
    Inputs (5):
        - likes
        - comments
        - postAgeHours
        - isFollowing
        - source
        
    Outputs (4 logits/probabilities):
        - like
        - comment
        - share
        - view
    """

    def __init__(self, input_size=5, output_size=4):
        super().__init__()

        self.network = nn.Sequential(        
            nn.Linear(input_size, 256),
            nn.ReLU(),     
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, output_size)  # Output size = 4 (like, comment, share, view)
        )

    def forward(self, x):
        return self.network(x)


# Alias for backward compatibility
FeedRanker = MultiObjectiveFeedRanker