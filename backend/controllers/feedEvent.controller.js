const FeedEvent = require("../models/model.feedEvent");
const { getOrCreateUser } = require("../utils/userHelper");
const { getAuth } = require("@clerk/express");
const { updateUserMemory } = require("../utils/userMemoryService");

const VALID_TYPES = new Set([
  "impression",
  "view",
  "like",
  "comment",
  "save",
  "share",
  "skip",
]);

// Events that carry enough positive signal to update user memory.
// "skip" and "impression" are omitted — skip is negative, impression is too weak.
const MEMORY_EVENTS = new Set([
  "view",
  "like",
  "comment",
  "save",
  "share",
]);

// POST /feed/events
// Body: { events: [{ postId, eventType, timestamp? }] }
//
// Accepts a batch of events from the client.  Returns 200 immediately —
// the client should treat this as fire-and-forget.
const recordEvents = async (req, res) => {
  // Respond first — don't make the user wait for DB writes
  res.status(200).json({ ok: true });

  try {
    const { userId } = getAuth(req);
    if (!userId) return;

    const user = await getOrCreateUser(userId);
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) return;

    // Validate and map to FeedEvent documents
    const docs = [];
    for (const e of events) {
      if (!e.postId || !VALID_TYPES.has(e.eventType)) continue;

      docs.push({
        user: user._id,
        post: e.postId,
        eventType: e.eventType,
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      });
    }

    if (docs.length === 0) return;

    // insertMany with ordered:false so one bad doc doesn't block the rest
    await FeedEvent.insertMany(docs, { ordered: false });

    console.log(
      `[FeedEvent] Recorded ${docs.length} events for user ${user._id}`
    );

    // Update user memory for strong-signal events (fire-and-forget, no await)
    for (const e of events) {
      if (!e.postId || !MEMORY_EVENTS.has(e.eventType)) continue;

      updateUserMemory({
        userId: user._id.toString(),
        postId: e.postId,
        eventType: e.eventType,
      });
    }
  } catch (err) {
    // Don't surface errors — this is background telemetry
    console.error("[FeedEvent] Error recording events:", err.message);
  }
};

module.exports = { recordEvents };
