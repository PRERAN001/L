const { redis } = require("./index");

const BASE_UPDATE_RATE = 0.1;

// Long-term memory changes slowly.
const DECAY_RATE = 0.005;

const INTERACTION_WEIGHTS = {
  impression: 0.05,
  view: 0.10,
  like: 0.50,
  comment: 0.70,
  save: 0.90,
  share: 1.00
};


const calculateRecencyWeight = (timestamp) => {
  const ageMs = Date.now() - timestamp;

  const ageHours =
    ageMs / (1000 * 60 * 60);

  return Math.exp(
    -DECAY_RATE * ageHours
  );
};


const updateLongTermMemory = async ({
  userId,
  postEmbedding,
  eventType,
  timestamp = Date.now()
}) => {

  const interactionWeight =
    INTERACTION_WEIGHTS[eventType] || 0;

  if (interactionWeight === 0) {
    return null;
  }

  const key =
    `user:${userId}:long_memory`;

  const existingData =
    await redis.get(key);


  // --------------------------------
  // First meaningful interaction
  // --------------------------------

  if (!existingData) {

    const memory = {
      embedding: postEmbedding,
      updatedAt: timestamp
    };

    await redis.set(
      key,
      JSON.stringify(memory)
    );

    console.log(
      `[longTermMemory] ✓ First interaction for user ${userId}:`,
      `[${postEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...] (${postEmbedding.length}D)`
    );

    return postEmbedding;
  }


  const memory =
    JSON.parse(existingData);

  const oldEmbedding =
    memory.embedding;


  // --------------------------------
  // Calculate recency
  // --------------------------------

  const recencyWeight =
    calculateRecencyWeight(timestamp);


  // --------------------------------
  // Calculate effective update
  // --------------------------------

  const effectiveRate =
    BASE_UPDATE_RATE *
    interactionWeight *
    recencyWeight;


  // --------------------------------
  // Update embedding
  // --------------------------------

  const newEmbedding =
    oldEmbedding.map((oldValue, i) => {

      const newValue =
        postEmbedding[i];

      return (
        (1 - effectiveRate) *
          oldValue +

        effectiveRate *
          newValue
      );
    });


  // --------------------------------
  // Store updated memory
  // --------------------------------

  const updatedMemory = {
    embedding: newEmbedding,
    updatedAt: timestamp
  };

  await redis.set(
    key,
    JSON.stringify(updatedMemory)
  );

  console.log(
    `[longTermMemory] ✓ Updated user ${userId} (rate=${effectiveRate.toFixed(4)}):`,
    `[${newEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...] (${newEmbedding.length}D)`
  );

  return newEmbedding;
};


const getLongTermMemory = async (userId) => {

  const key =
    `user:${userId}:long_memory`;

  const data =
    await redis.get(key);

  if (!data) {
    return null;
  }

  return JSON.parse(data);
};


module.exports = {
  updateLongTermMemory,
  getLongTermMemory,
  calculateRecencyWeight
};