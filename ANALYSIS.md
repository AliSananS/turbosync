# TurboSync Codebase Analysis

## Executive Summary

This document provides a comprehensive analysis of the TurboSync video syncing application. The codebase has several critical issues that need immediate attention, ranging from broken ping logic to fragile syncing mechanisms and security vulnerabilities.

---

## Critical Issues (P0 - Must Fix)

### 1. **Broken Ping/Latency Logic** 🚨
**Location:** `lib/room-context.tsx` (lines 135-149, 152-166)

**Problem:** The ping mechanism is fundamentally flawed:
- Uses Cloudflare's `setWebSocketAutoResponse` which responds automatically from the edge, NOT from the Durable Object
- The latency measured is edge-to-client latency, NOT actual server processing latency
- This gives users a false sense of their connection quality

**Current Code:**
```typescript
// Server-side (lib/room.ts line 46-48):
this.ctx.setWebSocketAutoResponse(
  new WebSocketRequestResponsePair("ping", "pong"),
);

// Client-side (lib/room-context.tsx line 137-149):
pingIntervalRef.current = setInterval(() => {
  const now = performance.now();
  if (now - lastPongReceivedAtRef.current > 5000) {
    // This timeout logic is also flawed
    ws.close();
  }
  pingStartRef.current = now;
  ws.send("ping");
}, 2000);
```

**Impact:** Users see fake low latency while actual DO communication might be slow.

**Fix:** Move ping handling into the DO's `webSocketMessage` handler with explicit pong responses.

---

### 2. **Fake Ping Display for Other Users** 🚨
**Location:** `components/player-dashboard.tsx` (lines 134-138)

**Problem:** The UI shows random fake ping values for other users:
```typescript
const userPing = isMe
  ? latency
  : isOnline
    ? Math.floor(Math.random() * 40) + 20  // <-- FAKE DATA
    : 0;
```

This is misleading and doesn't reflect actual network conditions.

---

### 3. **No Room Auto-Deletion** 🚨
**Location:** `lib/room.ts`

**Problem:** Rooms persist forever in Cloudflare's Durable Object storage. There's no mechanism to:
- Delete rooms after inactivity
- Clean up abandoned rooms
- Manage storage costs

**Impact:** Growing storage costs and potential namespace pollution.

**Fix:** Implement Durable Object alarms to delete rooms after 24 hours of inactivity.

---

### 4. **Broken Ownership/Host Logic** 🚨
**Location:** `lib/room.ts` (lines 278-300)

**Problem:** The host logic has race conditions and edge cases:
- Multiple users can claim host status simultaneously
- If host disconnects, there's no mechanism to promote another user
- `hasActiveHost` check happens AFTER setting `isHost = true` in some paths
- The `hostPeerId` logic can be bypassed

**Current problematic flow:**
```typescript
const hasActiveHost = Array.from(this.sessions.values()).some(
  (s) => s.isHost && s.peerId !== msg.user.peerId,
);

if (hostPeerId) {
  if (msg.user.peerId === hostPeerId) {
    isHost = true;  // What if hasActiveHost is true here?
  } else {
    isHost = false;
  }
} else if (isHost) {
  await this.ctx.storage.put("hostPeerId", msg.user.peerId);
}

// This check comes too late!
if (isHost && hasActiveHost) {
  isHost = false;
}
```

---

### 5. **No Video URL Synchronization** 🚨
**Location:** Entire codebase

**Problem:** Each user must independently load the video. There's no mechanism to:
- Share what video is being watched
- Sync video URL across users
- Handle different video sources gracefully

---

## High Priority Issues (P1)

### 6. **Fragile Syncing on Poor Connections**
**Location:** `components/player-dashboard.tsx` (lines 351-372)

**Problem:** The sync mechanism is too aggressive:
- Uses `drift > 0.5` seconds as threshold (hardcoded)
- No compensation for latency
- No buffering strategy for users catching up
- When pausing, doesn't seek to the furthest user

**Current sync logic:**
```typescript
const drift = Math.abs(internalTime - roomState.currentTime);
if (drift > 0.5) {
  playerRef.current.seek(roomState.currentTime);
}
```

**Issues:**
- Doesn't account for network latency
- Jarring user experience with frequent seeks
- No smooth catch-up mechanism

---

### 7. **Poor Reconnection Logic**
**Location:** `lib/room-context.tsx` (lines 304-326)

**Problems:**
- Exponential backoff caps at 10 seconds but starts at 1s (too aggressive)
- No jitter to prevent thundering herd
- Reconnection attempts aren't persisted across page reloads
- No visual feedback during reconnection attempts beyond console messages
- Uses `setTimeout` with NodeJS.Timeout type (incorrect for browser)

```typescript
const delay = Math.min(
  1000 * Math.pow(2, reconnectAttemptsRef.current),
  10000,
);
```

---

### 8. **No Auto-Sync on Buffering/Out-of-Sync**
**Location:** `components/player-dashboard.tsx`

**Problem:** The "Syncing" indicator (lines 231-234) is purely cosmetic:
```typescript
{Math.abs((displayTime || 0) - roomState.currentTime) > 2 && (
  <span className="...">Syncing</span>
)}
```

There's no actual automatic re-sync when users fall behind. Users must manually sync or wait for play/pause events.

---

### 9. **URL Input UX Issues**
**Location:** `components/local-video-player.tsx` (lines 412-496)

**Problems:**
- No validation that URL points to an actual video file
- No CORS preflight check before attempting to load
- No loading state during fetch validation
- No error handling for CORS failures
- Direct URL input is buried in a tab interface
- No URL sharing mechanism between users

---

### 10. **Race Condition in Time Update Reporting**
**Location:** `lib/room-context.tsx` (lines 375-381, 402-406)

**Problem:** Time updates are reported every 3 seconds, but:
- No debouncing or throttling on the server side
- Server broadcasts to ALL users (including sender)
- Can create feedback loops

---

## Medium Priority Issues (P2)

### 11. **Type Safety Issues**
**Location:** Multiple files

**Problems:**
- Use of `any` in several places (e.g., `initialData: Record<string, any>` in room.ts)
- `NodeJS.Timeout` used in browser context (room-context.tsx line 54, 61)
- Missing proper error types

### 12. **Memory Leaks**
**Location:** `lib/room-context.tsx`

**Problems:**
- `useEffect` cleanup may not run if component unmounts during reconnection
- Event listeners on `window` not properly cleaned up in all paths
- `URL.createObjectURL` in local-video-player.tsx (line 153) may not be revoked

### 13. **Security: No Rate Limiting**
**Location:** `lib/room.ts`

**Problems:**
- No rate limiting on WebSocket messages
- Users can spam play/pause/seek
- No protection against message flooding
- CORS proxy at `/api/proxy` can be abused

### 14. **Missing Error Boundaries**
**Location:** React components

**Problems:**
- No error boundaries around video player
- Component crashes can take down entire app
- No fallback UI for video loading failures

---

## Design/UX Issues

### 15. **Settings Dialog Doesn't Persist**
**Location:** `components/room-settings-dialog.tsx`

**Problems:**
- Settings like `syncThreshold`, `autoPauseOnBuffering` are local state only
- Not synced to server or other users
- Changes are lost on page refresh

### 16. **Password Logic Confusion**
**Location:** `lib/room.ts`

**Problems:**
- Room password can be set at creation but never changed
- No way to remove password from existing room
- Password prompt on join doesn't indicate if room actually has password

### 17. **Kick Feature is Host-Only**
**Location:** `lib/room.ts` (lines 442-469)

**Problem:** Only host can kick, which doesn't work well with broken host logic.

### 18. **Video Source Not Shared**
**Location:** `components/local-video-player.tsx`

**Problems:**
- Each user independently loads video
- No mechanism to communicate "I'm watching X video"
- Could add video URL to room state

---

## Recommendations

### Immediate Actions (This Week)

1. **Fix ping logic** - Move ping/pong into DO message handler
2. **Remove fake ping display** - Show "unknown" or remove for other users
3. **Add DO alarm for room cleanup** - Delete rooms after 24h inactivity
4. **Fix host ownership logic** - Make it simpler and more robust

### Short Term (Next Sprint)

5. **Implement auto-sync** - When drift > threshold, smoothly catch up
6. **Improve reconnection** - Add jitter, better backoff, page persistence
7. **Add video URL sync** - Share video source in room state
8. **Add rate limiting** - Prevent spam

### Long Term (Next Month)

9. **Implement proper time sync protocol** - NTP-style sync with latency compensation
10. **Add buffering strategy** - Pause all when one user buffers
11. **Simplify auth model** - Remove host concept, allow anyone to control
12. **Add room persistence options** - Let users choose if room should persist

---

## Code Quality Issues

### Inconsistent Error Handling
- Some places use try/catch, others don't
- WebSocket errors not always propagated to UI

### Missing Tests
- No unit tests for DO logic
- No integration tests for sync behavior
- No E2E tests for user flows

### Documentation
- Missing inline documentation for complex sync logic
- No architecture decision records (ADRs)

---

## Architecture Concerns

1. **Single DO per room** - Rooms are limited by DO's single-threaded nature
2. **No horizontal scaling** - Large rooms will hit DO limits
3. **State all in memory** - DO storage is used but sessions map is in memory
4. **No persistence strategy** - Should use DO storage more for durability

---

## Summary by User-Reported Issues

| User Report | Status | Location | Severity |
|-------------|--------|----------|----------|
| Syncing fragile on poor connections | ✅ Confirmed | player-dashboard.tsx | P0 |
| Reconnecting doesn't work/takes too long | ✅ Confirmed | room-context.tsx | P1 |
| Out of sync doesn't auto-update | ✅ Confirmed | player-dashboard.tsx | P0 |
| Pause doesn't seek to furthest | ✅ Confirmed | lib/room.ts | P1 |
| Ping logic broken/fake | ✅ Confirmed | room-context.tsx, player-dashboard.tsx | P0 |
| Ownership logic broken | ✅ Confirmed | lib/room.ts | P0 |
| Direct URL UX bad | ✅ Confirmed | local-video-player.tsx | P2 |
| Requires everyone to update URL | ✅ Confirmed | Architecture | P1 |

---

## Estimated Fix Effort

| Fix | Estimated Effort | Complexity |
|-----|-----------------|------------|
| Fix ping logic | 2-3 hours | Medium |
| Add room cleanup | 2 hours | Low |
| Fix host ownership | 4-6 hours | High |
| Auto-sync improvements | 4-8 hours | High |
| Reconnection improvements | 3-4 hours | Medium |
| Add video URL sync | 4-6 hours | Medium |
| Rate limiting | 2-3 hours | Low |
| Overall sync rewrite | 2-3 weeks | Very High |

---

*Analysis completed: 2026-04-21*
*Analyzed files: 15 core files*
*Total lines reviewed: ~3500*
