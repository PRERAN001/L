const { redis } = require("./index");

const MAX_INTERACTIONS = 50;

// Controls how quickly old interactions lose influence.
// Higher value = faster decay.
const DECAY_RATE = 0.1;

const INTERACTION_WEIGHTS = {
  impression: 0.05,
  view: 0.10,
  like: 0.50,
  comment: 0.70,
  save: 0.90,
  share: 1.00,
};


// Calculate recency weight.
//
// t = age of interaction in hours
//
// R(t) = e^(-lambda * t)
const calculateRecencyWeight = (timestamp) => {
  const ageMs = Date.now() - timestamp;

  const ageHours =
    ageMs / (1000 * 60 * 60);

  return Math.exp(
    -DECAY_RATE * ageHours
  );
};


const calculateShortTermMemory = (interactions) => {
  if (interactions.length === 0) {
    return null;
  }

  const embeddingSize =
    interactions[0].embedding.length;

  const memory = new Array(
    embeddingSize
  ).fill(0);

  let totalWeight = 0;

  for (const interaction of interactions) {

    const interactionWeight =
      INTERACTION_WEIGHTS[
        interaction.eventType
      ] || 0;

    if (interactionWeight === 0) {
      continue;
    }

    const recencyWeight =
      calculateRecencyWeight(
        interaction.timestamp
      );

    const weight =
      interactionWeight *
      recencyWeight;

    totalWeight += weight;

    for (let i = 0; i < embeddingSize; i++) {
      memory[i] +=
        interaction.embedding[i] *
        weight;
    }
  }

  if (totalWeight === 0) {
    return null;
  }

  // Weighted average
  for (let i = 0; i < embeddingSize; i++) {
    memory[i] /= totalWeight;
  }

  return memory;
};


const updateShortTermMemory = async ({
  userId,
  postId,
  postEmbedding,
  eventType
}) => {

  const interactionWeight =
    INTERACTION_WEIGHTS[eventType] || 0;

  if (interactionWeight === 0) {
    return null;
  }

  const key =
    `user:${userId}:short_interactions`;

  const interaction = {
    postId,
    embedding: postEmbedding,
    eventType,
    timestamp: Date.now()
  };

  // Get previous interactions
  const existingData =
    await redis.get(key);

  let interactions = existingData
    ? JSON.parse(existingData)
    : [];

  // Add newest interaction
  interactions.push(interaction);

  // Keep only the most recent N interactions
  if (
    interactions.length >
    MAX_INTERACTIONS
  ) {
    interactions =
      interactions.slice(
        -MAX_INTERACTIONS
      );
  }

  // Store interaction history
  await redis.set(
    key,
    JSON.stringify(interactions)
  );

  // Recalculate current short-term representation
  const shortTermMemory =
    calculateShortTermMemory(
      interactions
    );

  if (shortTermMemory) {
    console.log(
      `[shortTermMemory] Updated for user ${userId}:`,
      `${interactions.length} interactions →`,
      `[${shortTermMemory.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...] (${shortTermMemory.length}D)`
    );
  }

  return shortTermMemory;
};


module.exports = {
  updateShortTermMemory,
  calculateShortTermMemory,
  calculateRecencyWeight
};