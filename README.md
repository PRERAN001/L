# Production Feed Recommendation & Ranking Architecture

## System Overview

This document details the end-to-end architecture, mathematical modeling, and algorithmic design of the personalized content recommendation and feed infrastructure. The system implements a two-stage retrieval and ranking pipeline inspired by modern production systems (such as Instagram and TikTok), progressing from basic fanout strategies to vector-based memory networks, logistic engagement prediction, and Maximal Marginal Relevance (MMR) diversification.

##  Feed Preview

<img width="300" alt="Feed preview 1" src="https://github.com/user-attachments/assets/28894363-5494-400e-a095-af7f91e7b532" />

<img width="300" alt="Feed preview 2" src="https://github.com/user-attachments/assets/f22e6627-f669-410b-9443-e19bf06afce7" />
---

## 1. High-Level Pipeline Architecture

The recommendation pipeline operates in four discrete stages upon every client feed request:

```
[Candidate Retrieval] 
       │
       ▼
[Feature Extraction & Vector Loading] 
       │
       ▼
[Multi-Task Logistic Scoring] 
       │
       ▼
[MMR Diversity Reranking & Pagination]
```

1. **Candidate Retrieval**: Extracts candidates from heterogeneous sources (Following Fanout, Trending Sorted Sets, and Exploration Sets).
2. **Feature Extraction & Embedding Fusion**: Enriches candidates with social graph metrics, engagement signals, decay factors, and user affinity vectors.
3. **Multi-Task Scoring**: Predicts independent probabilities for Likes, Comments, and Views using logistic regression models, combined into a singular composite engagement score.
4. **Diversity Reranking (MMR)**: Penalizes semantic redundancy among top candidates using cosine distance over 384-dimensional dense embeddings.
5. **Continuous Feed Pagination**: Employs an offset-safe continuous cursor mechanism that guarantees non-terminating feeds for both photo streams and vertical video reels.

---

## 2. Evolution of Feed Architecture (v1 to v13)

### v1 to v6: Foundational Retrieval & Fanout Mechanics

* **v1 — Global Relational Queries**: Naive queries sorted solely by creation timestamps (`ORDER BY createdAt DESC`). Highly inefficient at scale due to index contention and lack of personalization.
* **v2 — Direct Following Fanout**: Queries restricted to the user's explicit following graph (`{ user: { $in: followingIds } }`).
* **v3 — Fanout-on-Write with Redis**: When a user creates a post, the post ID is pushed to the Redis Sorted Sets (`feed:<userId>`) of all followers. This shifts computational load from read-time to write-time, achieving sub-millisecond timeline reads.
* **v4 — Hybrid Fanout (The Celebrity / High-Follower Problem)**: Users with more than 500 followers bypass fanout-on-write to prevent Redis write amplification and network saturation. For large accounts, fanout-on-read is utilized dynamically during candidate generation.
* **v5 — Multi-Source Candidate Pooling**: Combines three distinct candidate streams:
  * *Following Stream*: Posts from followed accounts (high social affinity).
  * *Trending Stream*: Posts scoring highest on global Redis sorted sets (`trending:posts`).
  * *Exploration Stream*: Posts from accounts outside the social graph to facilitate discovery.
* **v6 — Interaction Logging & Asynchronous Ingestion**: Client-side viewability tracking emits structured events (`impression`, `view`, `skip`, `like`, `comment`, `share`) batched and processed asynchronously to prevent blocking the read path.

### v7 to v13: Machine Learning, Memory Vectors, and Production Optimization

* **v7 — Dense Semantic Embeddings**: Every post caption and media type is transformed into a normalized 384-dimensional dense vector via an embedding microservice utilizing a Transformer model (`all-MiniLM-L6-v2`).
* **v8 — Short-Term Memory Vector (U_short)**: Tracks real-time session intent. Maintains a sliding window of the user's latest 50 interactions weighted by interaction type and exponential time decay.
* **v9 — Long-Term Memory Vector (U_long)**: Captures permanent, persistent user interests. Updates via an Exponential Moving Average (EMA) upon every positive engagement.
* **v10 — Dynamic Memory Fusion (U_current)**: Blends short-term and long-term memory vectors to establish the active user preference state at request time.
* **v11 — Logistic Multi-Task Ranking**: Replaces static heuristics with multi-objective logistic models predicting $P(\text{like})$, $P(\text{comment})$, and $P(\text{view})$.
* **v12 — Maximal Marginal Relevance (MMR) Diversification**: Eliminates topic clustering and semantic repetition in the final ranked slate.
* **v13 — Continuous Stream Paging & Media Segregation**: Fully decouples photo feeds from video reels with dedicated candidate generation, infinite cursor wrapping, and proactive Redis cache invalidation.

---

## 3. Candidate Generation Layer

The candidate generation layer gathers up to 60 candidates per request across four distinct sources:

### 3.1 Following Candidates
* **Small Accounts (< 500 followers)**: Read directly from the user's Redis sorted set `feed:<userId>` using reverse score ranges.
* **Large Accounts (>= 500 followers)**: Queried on-demand from MongoDB via indexed follower lookups.

### 3.2 Trending Candidates
Maintained in a global Redis ZSET (`trending:posts`). Scores are dynamically adjusted via `ZINCRBY` on incoming events:
* Like: $+1$
* Comment: $+3$
* Share: $+5$
* Skip / Decay: Periodic score attenuation

### 3.3 Exploration Candidates
Retrieves non-followed content from the database. On pagination requests, queries use offset slicing to guarantee discovery of unseen content across the entire corpus.

### 3.4 Media Isolation
The query layer strictly enforces media separation:
* **Home Feed**: `mediaType: { $ne: "video" }`
* **Reels Feed**: `mediaType: "video"`

---

## 4. User Memory System (Dual-Vector Architecture)

The system models user preferences using two complementary dense vectors in $\mathbb{R}^{384}$, L2-normalized:

```
[Incoming Interactions] ──► [Short-Term Memory (Window + Exponential Decay)] ──► U_short
                                                                                   │
                                                                                   ├─► U_current = λ·U_long + (1-λ)·U_short
                                                                                   │
[Positive Engagements]  ──► [Long-Term Memory (Exponential Moving Average)]   ──► U_long
```

### 4.1 Short-Term Memory ($U_{\text{short}}$)
Maintains up to 50 recent interactions in Redis list `user:short:<userId>`. Each interaction contains:
* Post embedding vector $\vec{v}_i$
* Interaction weight $w_{\text{type}}$
* Timestamp $t_i$

Interaction weights are configured as:
$$\text{Impression} = 0.05, \quad \text{View} = 0.10, \quad \text{Like} = 0.50, \quad \text{Comment} = 0.70, \quad \text{Save} = 0.90, \quad \text{Share} = 1.00$$

Recency decay for interaction $i$ occurring $\Delta t_i$ hours ago is computed as:
$$R(\Delta t_i) = e^{-\gamma \cdot \Delta t_i} \quad (\text{where } \gamma = 0.1)$$

The composite short-term vector is the weighted normalized sum:
$$U_{\text{short}} = \text{Normalize}\left( \sum_{i=1}^{N} w_{\text{type}, i} \cdot R(\Delta t_i) \cdot \vec{v}_i \right)$$

### 4.2 Long-Term Memory ($U_{\text{long}}$)
Stored in Redis string `user:long:<userId>`. Represents the user's core historical profile. Upon each positive interaction (like, comment, share) with a post of vector $\vec{v}$, $U_{\text{long}}$ is updated using an Exponential Moving Average (EMA) with learning rate $\alpha = 0.1$:
$$U_{\text{long}}^{(t+1)} = \text{Normalize}\left( (1 - \alpha) \cdot U_{\text{long}}^{(t)} + \alpha \cdot \vec{v} \right)$$

### 4.3 Active Memory Blending ($U_{\text{current}}$)
During ranking, the active preference vector is computed by interpolating long-term stability and short-term session dynamics:
$$U_{\text{current}} = \text{Normalize}\left( \lambda \cdot U_{\text{long}} + (1 - \lambda) \cdot U_{\text{short}} \right) \quad (\text{where } \lambda = 0.7)$$

---

## 5. Feature Engineering & Multi-Task Ranking

Each candidate post $p$ is evaluated against the requesting user $u$ to produce a structured feature vector:

$$\vec{f} = \big[ \text{simCurrent}, \text{simShort}, \text{simLong}, \text{isFollowing}, \text{isSelf}, \text{likes}, \text{comments}, \text{postAgeHours}, \text{source} \big]$$

### 5.1 Cosine Similarities
Cosine similarities between the post embedding $\vec{v}_p$ and memory vectors are computed as dot products (since all vectors are L2-normalized):
$$\text{simCurrent} = U_{\text{current}} \cdot \vec{v}_p, \quad \text{simShort} = U_{\text{short}} \cdot \vec{v}_p, \quad \text{simLong} = U_{\text{long}} \cdot \vec{v}_p$$

### 5.2 Engagement and Decay Transforms
* **Log-Engagement Normalization**:
  $$\text{logNorm}(x) = \log_{10}(\max(x, 0) + 1)$$
* **Time Decay**:
  $$\text{ageDecay}(t) = \frac{40}{(\max(t, 0) + 0.5)^{0.6}}$$

### 5.3 Multi-Objective Logistic Models
The system computes three calibrated engagement probabilities using logistic functions $\sigma(z) = \frac{1}{1 + e^{-z}}$:

#### Probability of Like:
$$z_{\text{like}} = -1.5 + 3.5 \cdot \text{simCurrent} + 1.5 \cdot \text{simShort} + 0.8 \cdot \text{simLong} + 0.8 \cdot \text{isFollowing} + 0.4 \cdot \text{isSelf} + 0.6 \cdot \text{logNorm}(\text{likes}) + 0.4 \cdot \text{logNorm}(\text{comments}) + 0.003 \cdot \text{ageDecay}(t) + 0.5 \cdot \text{sourceScore} - 0.3 \cdot (1 - \text{hasEmbedding})$$

$$P(\text{like}) = \sigma(z_{\text{like}})$$

#### Probability of Comment:
$$z_{\text{comment}} = -2.5 + 3.0 \cdot \text{simCurrent} + 1.2 \cdot \text{simShort} + 0.6 \cdot \text{simLong} + 0.7 \cdot \text{isFollowing} + 0.3 \cdot \text{isSelf} + 0.5 \cdot \text{logNorm}(\text{likes}) + 0.7 \cdot \text{logNorm}(\text{comments}) + 0.002 \cdot \text{ageDecay}(t) + 0.4 \cdot \text{sourceScore}$$

$$P(\text{comment}) = \sigma(z_{\text{comment}})$$

#### Probability of View:
$$z_{\text{view}} = -0.8 + 2.0 \cdot \text{simCurrent} + 1.0 \cdot \text{simShort} + 0.5 \cdot \text{isFollowing} + 0.4 \cdot \text{logNorm}(\text{likes}) + 0.3 \cdot \text{logNorm}(\text{comments}) + 0.005 \cdot \text{ageDecay}(t) + 0.3 \cdot \text{sourceScore}$$

$$P(\text{view}) = \sigma(z_{\text{view}})$$

#### Composite Engagement Score:
$$\text{Score}(p) = 1.0 \cdot P(\text{like}) + 3.0 \cdot P(\text{comment}) + 0.5 \cdot P(\text{view}) + \text{ExplorationBoost} + \epsilon$$

Where:
* $\text{ExplorationBoost} = 0.15$ if post age $< 2\text{h}$ and engagement count $< 5$.
* $\epsilon \sim \text{Uniform}(-0.05, 0.05) \cdot \text{Score}_{\text{base}}$ provides stochastic exploration to prevent feedback loops.

---

## 6. Maximal Marginal Relevance (MMR) Diversification

To prevent recommendation echo-chambers where top-scored items belong to the same topical cluster, the final candidate selection applies Maximal Marginal Relevance:

$$\text{MMR}(d) = \arg\max_{d \in R \setminus S} \left[ \lambda_{\text{MMR}} \cdot \text{Score}(d) - (1 - \lambda_{\text{MMR}}) \cdot \max_{s \in S} \text{Sim}(d, s) \right]$$

Where:
* $R$ is the ranked candidate pool.
* $S$ is the set of already selected items.
* $\text{Sim}(d, s) = \vec{v}_d \cdot \vec{v}_s$ is the cosine similarity between item embeddings.
* $\lambda_{\text{MMR}} = 0.7$ balances relevance against novelty.

### Author Diversity Constraints
In addition to semantic MMR, hard constraints enforce creator diversity:
* Maximum 2 consecutive posts from the same author.
* Maximum 3 total posts from the same author within a single page.

---

## 7. Caching & Real-Time Invalidation Strategy

To achieve sub-10ms response times for repeat visits while preserving real-time responsiveness to user actions, the service implements selective Redis caching:

1. **Read Path**: Page 1 feed responses are cached in Redis (`feed:v2:photos:<userId>` and `reels:v2:<userId>`) with a 90-second TTL.
2. **Write Invalidation**: Any write action by the user (like, comment, share, new upload) triggers immediate asynchronous cache deletion via `invalidateFeedCache(userId)`.
3. **Live Recomputation**: The subsequent feed or reels request immediately pulls fresh candidates and recomputes ML features against the newly updated memory vector.

---

## 8. Continuous Pagination & Infinite Scroll

### Cursor Offset Protocol
To eliminate cursor-trap conditions where ML ranking reorders old and new items across timestamp boundaries:
* Cursors are encoded as monotonic integer offsets (`0`, `20`, `40`, `60`, ...).
* Candidate queries utilize modulo database offsets to prevent premature pagination termination.
* When a user reaches the end of historical unseen posts, the system seamlessly cycles exploration candidates with rank jitter, ensuring uninterrupted continuous feeds across both Home and Reels sections.

---

## 9. Telemetry and Event Stream Processing

Passive scroll events are gathered on client devices via viewability observers and dispatched in 5-second batches to `/api/feed/events`:
* **Impression**: Fires upon candidate container intersection with the active viewport.
* **View**: Fires when a post remains in the viewport for at least 1,000ms.
* **Skip**: Fires if a post is scrolled out of the viewport under 1,000ms without explicit interaction.
* **Engagement (Like / Comment / Share)**: Transmitted immediately to update Redis memory vectors in real time.
