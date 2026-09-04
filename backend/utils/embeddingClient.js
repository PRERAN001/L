// utils/embeddingClient.js
//
// Thin HTTP client for the Python embedding microservice (ml/embeddings/embed.py).
// Returns a normalised 384-dim float array, or null when the service is
// unreachable / the post has no usable text.

const EMBED_URL =
  (process.env.EMBED_SERVICE_URL || "http://localhost:8000") + "/embed";

// How long to wait before giving up — embedding is best-effort at write time
const TIMEOUT_MS = 3000;


// Build a text string from whatever is available on a post/caption.
// Extend this if you later add tags, alt-text, etc.
const buildPostText = ({ caption = "", mediaType = "" }) => {
  const parts = [];

  if (caption.trim()) {
    parts.push(caption.trim());
  }

  // Light type hint so the model has some signal even for captionless posts
  if (mediaType === "video") {
    parts.push("video post");
  }

  return parts.join(" ").trim();
};


const getEmbedding = async (text) => {
  if (!text || !text.trim()) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Embedding service HTTP ${res.status}`);
    }

    const { embedding } = await res.json();

    return Array.isArray(embedding) ? embedding : null;
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("[embeddingClient] Timeout — embedding service too slow");
    } else {
      console.warn("[embeddingClient] Error:", err.message);
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
};


// Convenience wrapper — accepts a post-like object with caption / mediaType
const getPostEmbedding = async (post) => {
  const text = buildPostText(post);

  return getEmbedding(text);
};


module.exports = {
  getEmbedding,
  getPostEmbedding,
  buildPostText,
};
