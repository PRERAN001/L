/**
 * useFeedTracker
 *
 * Tracks viewability events for feed posts and batches them to the server.
 *
 * Events emitted:
 *   impression  — post enters the viewport for the first time
 *   view        — post has been visible for ≥ VIEW_THRESHOLD_MS (user actually read it)
 *   skip        — post left the viewport before VIEW_THRESHOLD_MS with no engagement
 *
 * Engagement events (like, comment) are recorded separately by their own
 * handlers — this hook only tracks passive scroll behaviour.
 *
 * Usage:
 *   const { onPostViewable, onPostHidden, recordEngagement } = useFeedTracker(posts);
 *   <View onLayout={…} ref={ref}>          ← each post container
 *     …call onPostViewable(post.id) when it scrolls into view
 *     …call onPostHidden(post.id)   when it scrolls out of view
 *   </View>
 *
 * With ScrollView we can't use IntersectionObserver, so the parent drives
 * visibility via onScroll + layout measurements (see FeedPostWrapper below).
 */

import { useRef, useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@clerk/expo";

// A post must be visible for this long to count as a genuine "view"
const VIEW_THRESHOLD_MS = 1000;

// How often we flush the event batch to the server (ms).
// Short enough to not lose data; long enough to amortise requests.
const FLUSH_INTERVAL_MS = 5000;

type EventType = "impression" | "view" | "skip" | "like" | "comment" | "save" | "share";

interface PendingEvent {
  postId: string;
  eventType: EventType;
  timestamp: number;
}

interface PostState {
  impressed: boolean;        // impression already fired
  viewed: boolean;           // view already fired
  engaged: boolean;          // user tapped like/comment — skip suppressed
  visibleSince: number | null; // Date.now() when it entered viewport
  viewTimer: ReturnType<typeof setTimeout> | null;
}

export function useFeedTracker() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // Live state per post — kept in a ref so callbacks never need to re-create
  const postStates = useRef<Map<string, PostState>>(new Map());

  // Outgoing event queue — flushed every FLUSH_INTERVAL_MS
  const queue = useRef<PendingEvent[]>([]);

  const enqueue = useCallback((postId: string, eventType: EventType) => {
    queue.current.push({ postId, eventType, timestamp: Date.now() });
  }, []);

  // ─── Flush ────────────────────────────────────────────────────────────────

  const flush = useCallback(async () => {
    if (queue.current.length === 0) return;

    const batch = queue.current.splice(0); // drain atomically
    try {
      const token = await getTokenRef.current();
      await apiFetch(
        "/feed/events",
        {
          method: "POST",
          body: JSON.stringify({ events: batch }),
        },
        token
      );
    } catch {
      // Put them back if the request failed so we don't lose data
      queue.current.unshift(...batch);
    }
  }, []);

  // Periodic flush
  useEffect(() => {
    const id = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flush]);

  // Flush when app goes to background (user switches apps / locks phone)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        flush();
      }
    });
    return () => sub.remove();
  }, [flush]);

  // ─── Per-post API ──────────────────────────────────────────────────────────

  /** Call when a post scrolls into the visible viewport. */
  const onPostViewable = useCallback((postId: string) => {
    let state = postStates.current.get(postId);
    if (!state) {
      state = {
        impressed: false,
        viewed: false,
        engaged: false,
        visibleSince: null,
        viewTimer: null,
      };
      postStates.current.set(postId, state);
    }

    // Impression: first time the post enters the viewport
    if (!state.impressed) {
      state.impressed = true;
      enqueue(postId, "impression");
    }

    state.visibleSince = Date.now();

    // Start the view timer if not already fired
    if (!state.viewed && !state.viewTimer) {
      state.viewTimer = setTimeout(() => {
        const s = postStates.current.get(postId);
        if (!s) return;
        s.viewTimer = null;
        if (!s.viewed) {
          s.viewed = true;
          enqueue(postId, "view");
        }
      }, VIEW_THRESHOLD_MS);
    }
  }, [enqueue]);

  /** Call when a post scrolls out of the visible viewport. */
  const onPostHidden = useCallback((postId: string) => {
    const state = postStates.current.get(postId);
    if (!state) return;

    // Cancel the pending view timer
    if (state.viewTimer) {
      clearTimeout(state.viewTimer);
      state.viewTimer = null;
    }

    // Skip: post was impressed but user scrolled past before VIEW_THRESHOLD_MS
    // and never engaged with it.
    if (state.impressed && !state.viewed && !state.engaged) {
      enqueue(postId, "skip");
      // Mark as viewed so we don't fire skip again if it re-enters viewport
      state.viewed = true;
    }

    state.visibleSince = null;
  }, [enqueue]);

  /**
   * Call when the user actively engages with a post (like, comment, share).
   * Records the engagement event and suppresses any pending skip.
   */
  const recordEngagement = useCallback((postId: string, eventType: "like" | "comment" | "save" | "share") => {
    const state = postStates.current.get(postId);
    if (state) {
      state.engaged = true;
    }
    // Enqueue the engagement event to be sent to the backend
    enqueue(postId, eventType);
  }, [enqueue]);

  /** Reset tracking state when the feed refreshes (new candidate pool). */
  const resetTracking = useCallback(() => {
    // Clear all timers before wiping state
    postStates.current.forEach((s) => {
      if (s.viewTimer) clearTimeout(s.viewTimer);
    });
    postStates.current.clear();
  }, []);

  return { onPostViewable, onPostHidden, recordEngagement, resetTracking, flush };
}
