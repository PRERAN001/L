# Feed Recommendation & Machine Learning Ranking Architecture

## System Overview

This project implements a personalized content recommendation and ranking engine for photos and video reels, similar to architectures used at Instagram and TikTok. It uses a two-stage retrieval and ranking pipeline that pairs Redis-backed candidate retrieval with a real-time vector memory system, multi-task logistic prediction models, and Maximal Marginal Relevance (MMR) diversification.

## Feed Preview

<p align="center">
  <img width="300" alt="Feed preview 1" src="https://github.com/user-attachments/assets/28894363-5494-400e-a095-af7f91e7b532" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img width="300" alt="Feed preview 2" src="https://github.com/user-attachments/assets/f22e6627-f669-410b-9443-e19bf06afce7" />
</p>

---

## 1. High-Level Recommendation Pipeline

Whenever a user opens the app or requests more content, the feed passes through four sequential stages:

```
[ Stage 1: Candidate Gathering ]
Fetch ~60 candidate posts from Following, Trending, and Exploration sources.
               │
               ▼
[ Stage 2: Memory & Feature Loading ]
Load user taste vectors (U_short, U_long, U_current) and compute cosine similarities.
               │
               ▼
[ Stage 3: Multi-Task Machine Learning Scoring ]
Predict P(like), P(comment), P(view) using calibrated logistic models.
               │
               ▼
[ Stage 4: MMR Diversification & Delivery ]
Spread out similar topics, apply creator limits, and return continuous pages.
```

---

## 2. Architecture Evolution (v1 to v13)

### v1 to v6: Core Retrieval and Fanout Strategies

* **v1 — Global Timestamp Sorting**: Simple query sorting all posts by `createdAt DESC`. Inefficient at scale and identical for all users.
* **v2 — Following Feed**: Queries filtered to accounts the user directly follows (`{ user: { $in: followingIds } }`).
* **v3 — Fanout-on-Write with Redis**: On post creation, the post ID is immediately pushed to the Redis Sorted Sets (`feed:<userId>`) of all followers. This delivers sub-millisecond read times upon app launch.
* **v4 — Hybrid Fanout for Popular Accounts**: Accounts with over 500 followers skip fanout-on-write to prevent write amplification. Their posts are fetched dynamically on-read instead.
* **v5 — Multi-Source Candidate Pooling**: Gathers candidates from three distinct streams:
  * *Following*: Content from accounts the user follows.
  * *Trending*: High-velocity posts from global Redis sets (`trending:posts`).
  * *Exploration*: Content outside the social network to discover new interests.
* **v6 — Interaction Logging**: Client-side viewability tracking logs passive and active events (`impression`, `view`, `skip`, `like`, `comment`, `share`) in 5-second batches.

### v7 to v13: Vector Embeddings, Memory Vectors, and ML Ranking

* **v7 — Dense Semantic Embeddings**: Text captions and media types are converted into 384-dimensional dense vectors using the `all-MiniLM-L6-v2` transformer model.
* **v8 — Short-Term Session Memory ($U_{\text{short}}$)**: Tracks the user's last 50 interactions with exponential time decay.
* **v9 — Long-Term Memory ($U_{\text{long}}$)**: Captures permanent preferences using Exponential Moving Average (EMA) updates.
* **v10 — Live Memory Fusion ($U_{\text{current}}$)**: Blends $U_{\text{long}}$ and $U_{\text{short}}$ into a single active preference vector.
* **v11 — Logistic Multi-Task Ranking**: Replaces heuristics with calibrated models predicting $P(\text{like})$, $P(\text{comment})$, and $P(\text{view})$.
* **v12 — Maximal Marginal Relevance (MMR)**: Re-ranks top items to eliminate repetitive topics and echo chambers.
* **v13 — Continuous Paging & Media Segregation**: Photo feeds and video reels are strictly separated, and offset cursor pagination ensures feeds scroll continuously without stopping.

---

## 3. Candidate Generation Layer

Instead of scoring thousands of posts in the database, the system retrieves a candidate pool of 60 items across three channels:

1. **Following Stream**:
   * For standard accounts (< 500 followers): Read directly from `feed:<userId>` in Redis.
   * For large accounts (>= 500 followers): Read dynamically from MongoDB.
2. **Trending Stream**:
   * Pulled from the Redis sorted set `trending:posts`, where scores update dynamically on user actions:
     * Like: $+1$
     * Comment: $+3$
     * Share: $+5$
3. **Exploration Stream**:
   * Pulled from MongoDB for accounts outside the user's social network.

### Media Type Segregation
* **Home Feed**: Filtered strictly to `mediaType: { $ne: "video" }` (photos only).
* **Reels Feed**: Filtered strictly to `mediaType: "video"` (vertical video reels only).

---

## 4. User Taste Vector Modeling (Dual Memory)

User preferences are represented by two complementary 384-dimensional vectors ($\mathbb{R}^{384}$), both L2-normalized.

```
[Actions: View, Like, Comment, Share] ──► [Short-Term Memory Window] ──► U_short
                                                                           │
                                                                           ├─► U_current = λ·U_long + (1-λ)·U_short
                                                                           │
[Positive Signals: Like, Comment, Share] ──► [EMA Long-Term Memory]  ──► U_long
```

### 4.1 Short-Term Memory ($U_{\text{short}}$)

Short-term memory captures what the user is actively interested in during the current session. It holds the last 50 interactions in a Redis list (`user:short:<userId>`).

#### Interaction Weights ($w_{\text{type}}$)
Different actions signal different levels of interest:
* **Impression** $= 0.05$ (scrolled past)
* **View** $= 0.10$ (watched or looked for >= 1 second)
* **Like** $= 0.50$ (explicit positive feedback)
* **Comment** $= 0.70$ (high investment positive feedback)
* **Save** $= 0.90$ (intent to revisit)
* **Share** $= 1.00$ (highest endorsement signal)

#### Recency Time Decay ($R$)
Older interactions in the session lose influence according to exponential decay:

$$R(\Delta t) = e^{-\gamma \cdot \Delta t}$$

* $\Delta t$ is the age of the interaction in hours.
* $\gamma = 0.1$ is the decay rate. An interaction from 5 hours ago retains $\approx 60\%$ of its initial weight.

#### Computing $U_{\text{short}}$
The combined short-term vector is the weighted, decayed sum of interaction embeddings $\vec{v}_i$, normalized to unit length:

$$U_{\text{short}} = \text{Normalize}\left( \sum_{i=1}^{N} w_{\text{type}, i} \cdot R(\Delta t_i) \cdot \vec{v}_i \right)$$

---

### 4.2 Long-Term Memory ($U_{\text{long}}$)

Long-term memory represents persistent preferences built over weeks or months. Stored in Redis (`user:long:<userId>`), it updates on positive engagements (like, comment, share) using an Exponential Moving Average (EMA):

$$U_{\text{long}}^{(t+1)} = \text{Normalize}\left( (1 - \alpha) \cdot U_{\text{long}}^{(t)} + \alpha \cdot \vec{v}_{\text{post}} \right)$$

* $\alpha = 0.10$ is the learning rate.
* This updates 10% of the long-term vector toward the new post's topic while preserving 90% of the user's historical profile.

---

### 4.3 Active Preference Blending ($U_{\text{current}}$)

When scoring candidates, the system blends long-term stability with short-term intent:

$$U_{\text{current}} = \text{Normalize}\left( \lambda \cdot U_{\text{long}} + (1 - \lambda) \cdot U_{\text{short}} \right)$$

* $\lambda = 0.70$ assigns 70% weight to stable long-term taste and 30% weight to immediate session behavior.
* If the user is new (cold start) and has no long-term memory, $U_{\text{short}}$ is used directly.

---

## 5. Machine Learning Engagement Scoring

For each candidate post $p$, the system computes an engagement score using logistic regression models calibrated to real-world interaction baselines.

### 5.1 Feature Transformations

#### Cosine Similarity (Semantic Match)
Because all embeddings are L2-normalized unit vectors, cosine similarity is calculated via dot products:

$$\text{simCurrent} = U_{\text{current}} \cdot \vec{v}_p, \quad \text{simShort} = U_{\text{short}} \cdot \vec{v}_p, \quad \text{simLong} = U_{\text{long}} \cdot \vec{v}_p$$

#### Log-Compressed Engagement Counts
To prevent viral posts with thousands of likes from overwhelming the scoring, engagement counts are scaled logarithmically:

$$\text{logNorm}(x) = \log_{10}(\max(x, 0) + 1)$$

* 10 likes $\rightarrow 1.04$
* 100 likes $\rightarrow 2.00$
* 1,000 likes $\rightarrow 3.00$

#### Post Age Decay
Fresh content receives higher baseline visibility through a sub-linear decay curve:

$$\text{ageDecay}(t) = \frac{40}{(\max(t, 0) + 0.5)^{0.6}}$$

* $t$ is the post age in hours.
* A 1-hour-old post scores $\approx 31.7$
* A 24-hour-old post scores $\approx 5.8$

---

### 5.2 Multi-Objective Logistic Models

The system predicts three distinct interaction probabilities using the logistic sigmoid function:

$$\sigma(z) = \frac{1}{1 + e^{-z}}$$

#### 1. Probability of Like — $P(\text{like})$

$$z_{\text{like}} = -1.5 + 3.5 \cdot \text{simCurrent} + 1.5 \cdot \text{simShort} + 0.8 \cdot \text{simLong} + 0.8 \cdot \text{isFollowing} + 0.4 \cdot \text{isSelf} + 0.6 \cdot \text{logNorm}(\text{likes}) + 0.4 \cdot \text{logNorm}(\text{comments}) + 0.003 \cdot \text{ageDecay}(t) + 0.5 \cdot \text{sourceScore} - 0.3 \cdot (1 - \text{hasEmbedding})$$

$$P(\text{like}) = \sigma(z_{\text{like}})$$

* **Bias ($-1.5$)**: Reflects an average baseline like rate of $\approx 18\%$.
* **$\text{simCurrent}$ ($+3.5$)**: The strongest single ranking signal—measures how well the post matches the user's active taste.
* **Social signals ($+0.8, +0.4$)**: Boosts creators the user follows.

#### 2. Probability of Comment — $P(\text{comment})$

$$z_{\text{comment}} = -2.5 + 3.0 \cdot \text{simCurrent} + 1.2 \cdot \text{simShort} + 0.6 \cdot \text{simLong} + 0.7 \cdot \text{isFollowing} + 0.3 \cdot \text{isSelf} + 0.5 \cdot \text{logNorm}(\text{likes}) + 0.7 \cdot \text{logNorm}(\text{comments}) + 0.002 \cdot \text{ageDecay}(t) + 0.4 \cdot \text{sourceScore}$$

$$P(\text{comment}) = \sigma(z_{\text{comment}})$$

* **Bias ($-2.5$)**: Reflects that comments are rarer than likes (baseline $\approx 7\%$).
* **$\text{logNorm}(\text{comments})$ ($+0.7$)**: Active discussions encourage further commentary.

#### 3. Probability of View / Read — $P(\text{view})$

$$z_{\text{view}} = -0.8 + 2.0 \cdot \text{simCurrent} + 1.0 \cdot \text{simShort} + 0.5 \cdot \text{isFollowing} + 0.4 \cdot \text{logNorm}(\text{likes}) + 0.3 \cdot \text{logNorm}(\text{comments}) + 0.005 \cdot \text{ageDecay}(t) + 0.3 \cdot \text{sourceScore}$$

$$P(\text{view}) = \sigma(z_{\text{view}})$$

* **Bias ($-0.8$)**: Viewing or reading a post has a higher baseline probability ($\approx 31\%$).

---

### 5.3 Composite Ranking Score

The overall relevance score combines all three predicted probabilities with action weights, an exploration boost for new posts, and random jitter:

$$\text{Score}(p) = 1.0 \cdot P(\text{like}) + 3.0 \cdot P(\text{comment}) + 0.5 \cdot P(\text{view}) + \text{ExplorationBoost} + \epsilon$$

* **Action Weights**: Comments are weighted $3.0\times$ and likes $1.0\times$, prioritizing engaging discussions over passive views.
* **Exploration Boost**: Adds $+0.15$ if post age $< 2\text{ hours}$ and total engagements $< 5$, helping new content enter the distribution loop.
* **Stochastic Jitter ($\epsilon$)**: Adds $\pm 5\%$ random variation to prevent deterministic feedback loops and introduce feed freshness.

---

## 6. Maximal Marginal Relevance (MMR) Diversification

Sorting purely by engagement score can lead to topic saturation (e.g., ten consecutive posts about cars). To maintain variety, candidate selection uses Maximal Marginal Relevance:

$$\text{MMR}(d) = \arg\max_{d \in R \setminus S} \left[ \lambda_{\text{MMR}} \cdot \text{Score}(d) - (1 - \lambda_{\text{MMR}}) \cdot \max_{s \in S} \text{Sim}(d, s) \right]$$

* $R$: Pool of scored candidate posts.
* $S$: Set of posts already selected for the user's feed.
* $\text{Sim}(d, s) = \vec{v}_d \cdot \vec{v}_s$: Cosine similarity between candidate post $d$ and already selected post $s$.
* $\lambda_{\text{MMR}} = 0.70$: Balances relevance ($70\%$) against topical novelty ($30\%$).

### Author Diversity Rules
* Maximum 2 consecutive posts from the same creator.
* Maximum 3 total posts from the same creator on a single page.

---

## 7. Caching and Invalidation Strategy

To balance low latency with immediate responsiveness to user actions, the service implements selective Redis caching:

1. **Page 1 Read Caching**: Initial feed requests are cached in Redis (`feed:v2:photos:<userId>` and `reels:v2:<userId>`) with a 90-second TTL, serving repeat tab visits in $< 5\text{ms}$.
2. **Instant Write Invalidation**: When a user performs an active engagement (like, comment, share, or new post), `invalidateFeedCache(userId)` immediately deletes the user's cache keys.
3. **Live Re-Ranking**: The subsequent feed load re-pulls candidate posts, evaluates them against the updated taste vector, and computes a newly tailored feed ranking.

---

## 8. Continuous Infinite Paging

To prevent feeds from prematurely ending when ML ranking reorders posts across timestamp boundaries:
* Cursors are tracked as sequential integer offsets (`0`, `20`, `40`, `60`, ...).
* Database queries utilize modulo offsets (`offset % totalPosts`) once the initial catalog is viewed.
* When a user reaches the end of new content, the system seamlessly cycles exploration candidates with fresh ranking jitter, providing an endless feed for both photos and video reels.
