/**
 * MeshProvider -- React context that holds the live Meshlink client.
 *
 * After login/register the App stores a MeshlinkSession. This provider
 * creates a client, starts sync, and exposes helpers that the
 * ChatSidebar / ChatView components consume.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import * as sdk from "matrix-js-sdk";
import {
  createClient,
  startClient,
  stopClient,
  getUserDisplayName,
  getInitials,
  uploadMedia,
  mxcToUrl,
  mxcToThumbnail,
  type MeshlinkSession,
  type MeshClient,
  type MeshRoom as SdkRoom,
  type MeshEvent,
} from "@/lib/meshClient";

/* ------------------------------------------------------------------ */
/*  Public types consumed by UI components                            */
/* ------------------------------------------------------------------ */

export interface MeshRoom {
  id: string;
  name: string;
  avatar: string;
  avatarUrl: string | null;
  type: "dm" | "group";
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  members: number;
}

export interface MeshReaction {
  emoji: string;
  senderId: string;
  senderName: string;
}

export interface MeshReplyTo {
  eventId: string;
  senderId: string;
  senderName: string;
  text: string;
}

export interface MeshMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "file";
  mediaName?: string;
  mediaSize?: number;
  reactions: Record<string, MeshReaction[]>;
  replyTo?: MeshReplyTo;
}

/* ------------------------------------------------------------------ */
/*  Context value                                                     */
/* ------------------------------------------------------------------ */

interface MeshContextValue {
  client: MeshClient | null;
  ready: boolean;
  userId: string;
  rooms: MeshRoom[];
  getMessages: (roomId: string) => MeshMessage[];
  sendMessage: (roomId: string, text: string, replyToEventId?: string) => Promise<void>;
  sendMedia: (roomId: string, file: File) => Promise<void>;
  deleteMessage: (roomId: string, eventId: string) => Promise<void>;
  addReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  removeReaction: (roomId: string, eventId: string, emoji: string) => Promise<void>;
  forwardMessage: (fromRoomId: string, eventId: string, toRoomId: string) => Promise<void>;
  createDm: (userId: string) => Promise<string>;
  createGroup: (name: string, userIds: string[]) => Promise<string>;
  createChannel: (name: string) => Promise<string>;
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  leaveRoom: (roomId: string) => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  searchUsers: (term: string) => Promise<{ userId: string; displayName: string }[]>;
  searchMessages: (roomId: string, query: string) => MeshMessage[];
  getPublicRooms: () => Promise<MeshRoom[]>;
}

const MeshContext = createContext<MeshContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useMesh(): MeshContextValue {
  const ctx = useContext(MeshContext);
  if (!ctx) throw new Error("useMesh must be used inside <MeshProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Get the raw timestamp of the last message event in a room (for sorting). */
function getLastMessageTs(room: SdkRoom): number {
  const timeline = room.getLiveTimeline().getEvents();
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].getType() === "m.room.message") {
      return timeline[i].getTs();
    }
  }
  return room.getLiveTimeline().getEvents()[0]?.getTs() || 0;
}

/** Check if a room is a DM by inspecting m.direct account data or member count. */
function isDmRoom(room: SdkRoom, client: MeshClient): boolean {
  if (room.isSpaceRoom()) return false;
  const directEvent = client.getAccountData("m.direct");
  if (directEvent) {
    const directMap = directEvent.getContent() as Record<string, string[]>;
    for (const roomIds of Object.values(directMap)) {
      if (Array.isArray(roomIds) && roomIds.includes(room.roomId)) return true;
    }
  }
  const members = room.getJoinedMembers();
  return members.length <= 2;
}

function roomToMesh(room: SdkRoom, myUserId: string, client: MeshClient): MeshRoom {
  const members = room.getJoinedMembers();
  const isDm = isDmRoom(room, client);

  const timeline = room.getLiveTimeline().getEvents();
  const lastEvt = [...timeline].reverse().find(
    (e) => e.getType() === "m.room.message",
  );
  let lastMessage = "";
  let lastMessageTime = "";
  if (lastEvt) {
    const content = lastEvt.getContent();
    const msgtype = content.msgtype as string;
    if (msgtype === "m.image") lastMessage = "Photo";
    else if (msgtype === "m.video") lastMessage = "Video";
    else if (msgtype === "m.audio") lastMessage = "Audio";
    else if (msgtype === "m.file") lastMessage = "File: " + (typeof content.body === "string" ? content.body : "");
    else lastMessage = typeof content.body === "string" ? content.body : "";

    if (!isDm) {
      const senderName = getUserDisplayName(client, lastEvt.getSender()!);
      lastMessage = `${senderName}: ${lastMessage}`;
    }
    lastMessageTime = formatTime(lastEvt.getTs());
  }

  let name = room.name || "Unnamed";
  if (isDm) {
    const other = members.find((m) => m.userId !== myUserId);
    if (other) name = other.name || other.userId.split(":")[0].replace("@", "");
  }

  return {
    id: room.roomId,
    name,
    avatar: getInitials(name),
    avatarUrl: null,
    type: isDm ? "dm" : "group",
    lastMessage,
    lastMessageTime,
    unread: room.getUnreadNotificationCount("total") || 0,
    members: members.length,
  };
}

function eventToMesh(evt: MeshEvent, client: MeshClient, room: SdkRoom): MeshMessage | null {
  if (evt.getType() !== "m.room.message") return null;
  if (evt.isRedacted()) return null;
  const content = evt.getContent();
  const senderId = evt.getSender()!;
  const msgtype = content.msgtype as string;

  let text = typeof content.body === "string" ? content.body : "";
  let mediaUrl: string | undefined;
  let mediaType: "image" | "video" | "audio" | "file" | undefined;
  let mediaName: string | undefined;
  let mediaSize: number | undefined;

  const info = content.info as { size?: number; mimetype?: string } | undefined;

  if (msgtype === "m.image" && content.url) {
    mediaUrl = mxcToThumbnail(content.url as string, 800, 600);
    mediaType = "image";
    mediaName = text;
    mediaSize = info?.size;
    text = "";
  } else if (msgtype === "m.video" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaType = "video";
    mediaName = text;
    mediaSize = info?.size;
    text = "";
  } else if (msgtype === "m.audio" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaType = "audio";
    mediaName = text;
    mediaSize = info?.size;
    text = "";
  } else if (msgtype === "m.file" && content.url) {
    mediaUrl = mxcToUrl(content.url as string);
    mediaType = "file";
    mediaName = text;
    mediaSize = info?.size;
    text = "";
  }

  // Strip reply fallback from text
  if (text.startsWith("> ") && text.includes("\n\n")) {
    text = text.substring(text.indexOf("\n\n") + 2);
  }

  // Extract reactions
  const reactions: Record<string, MeshReaction[]> = {};
  const eventId = evt.getId()!;
  const allEvents = room.getLiveTimeline().getEvents();
  for (const e of allEvents) {
    if (e.getType() !== "m.reaction") continue;
    const rel = e.getContent()["m.relates_to"];
    if (!rel || rel.event_id !== eventId || rel.rel_type !== "m.annotation") continue;
    const emoji = rel.key as string;
    if (!emoji) continue;
    if (!reactions[emoji]) reactions[emoji] = [];
    reactions[emoji].push({ emoji, senderId: e.getSender()!, senderName: getUserDisplayName(client, e.getSender()!) });
  }

  // Extract reply-to
  let replyTo: MeshReplyTo | undefined;
  const relatesTo = content["m.relates_to"] as { "m.in_reply_to"?: { event_id: string } } | undefined;
  if (relatesTo?.["m.in_reply_to"]?.event_id) {
    const replyEventId = relatesTo["m.in_reply_to"].event_id;
    const replyEvent = allEvents.find((e) => e.getId() === replyEventId);
    if (replyEvent && replyEvent.getType() === "m.room.message") {
      const rc = replyEvent.getContent();
      replyTo = { eventId: replyEventId, senderId: replyEvent.getSender()!, senderName: getUserDisplayName(client, replyEvent.getSender()!), text: typeof rc.body === "string" ? rc.body : "" };
    }
  }

  return {
    id: eventId,
    senderId,
    senderName: getUserDisplayName(client, senderId),
    text,
    timestamp: formatTime(evt.getTs()),
    isOwn: senderId === client.getUserId(),
    mediaUrl,
    mediaType,
    mediaName,
    mediaSize,
    reactions,
    replyTo,
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface Props {
  session: MeshlinkSession;
  children: ReactNode;
}

export function MeshProvider({ session, children }: Props) {
  const clientRef = useRef<MeshClient | null>(null);
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<MeshRoom[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRooms = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const allRooms = c.getRooms();
    const joinedRooms = allRooms.filter((r) => r.getMyMembership() === "join");
    // Sort by last message timestamp (most recent first)
    joinedRooms.sort((a, b) => getLastMessageTs(b) - getLastMessageTs(a));
    const meshRooms = joinedRooms.map((r) => roomToMesh(r, session.userId, c));
    setRooms(meshRooms);
  }, [session.userId]);

  // Debounced refresh -- batches rapid events into one update
  const debouncedRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshRooms();
    }, 150);
  }, [refreshRooms]);

  useEffect(() => {
    let cancelled = false;
    const client = createClient(session);
    clientRef.current = client;

    const onEvent = () => {
      if (!cancelled) debouncedRefresh();
    };

    client.on(sdk.RoomEvent.Timeline, onEvent);
    client.on(sdk.RoomEvent.Name, onEvent);
    client.on(sdk.RoomEvent.MyMembership, onEvent);
    client.on(sdk.RoomMemberEvent.Membership, onEvent);

    startClient(client).then(() => {
      if (!cancelled) {
        setReady(true);
        refreshRooms();
      }
    });

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      client.removeAllListeners();
      stopClient(client);
      clientRef.current = null;
    };
  }, [session, refreshRooms, debouncedRefresh]);

  // --- Actions ---

  const getMessages = useCallback(
    (roomId: string): MeshMessage[] => {
      const c = clientRef.current;
      if (!c) return [];
      const room = c.getRoom(roomId);
      if (!room) return [];
      const events = room.getLiveTimeline().getEvents();
      return events
        .map((e) => eventToMesh(e, c, room))
        .filter((m): m is MeshMessage => m !== null);
    },
    [],
  );

  const sendMessage = useCallback(async (roomId: string, text: string, replyToEventId?: string) => {
    const c = clientRef.current;
    if (!c) return;
    if (replyToEventId) {
      await c.sendMessage(roomId, {
        msgtype: "m.text",
        body: text,
        "m.relates_to": { "m.in_reply_to": { event_id: replyToEventId } },
      });
    } else {
      await c.sendTextMessage(roomId, text);
    }
  }, []);

  const sendMedia = useCallback(async (roomId: string, file: File) => {
    const c = clientRef.current;
    if (!c) return;
    const mxcUri = await uploadMedia(session.accessToken, file);
    let msgtype = "m.file";
    if (file.type.startsWith("image/")) msgtype = "m.image";
    else if (file.type.startsWith("video/")) msgtype = "m.video";
    else if (file.type.startsWith("audio/")) msgtype = "m.audio";
    await c.sendMessage(roomId, {
      msgtype,
      body: file.name,
      url: mxcUri,
      info: { mimetype: file.type, size: file.size },
    });
  }, [session.accessToken]);

  const deleteMessage = useCallback(async (roomId: string, eventId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.redactEvent(roomId, eventId);
  }, []);

  const createDm = useCallback(async (targetUserId: string): Promise<string> => {
    const c = clientRef.current;
    if (!c) throw new Error("Not connected");

    // Check if a DM already exists with this user
    const existingRooms = c.getRooms();
    for (const room of existingRooms) {
      if (room.getMyMembership() !== "join") continue;
      if (!isDmRoom(room, c)) continue;
      const members = room.getJoinedMembers();
      const invited = room.getMembersWithMembership("invite");
      const allUserIds = [...members, ...invited].map((m) => m.userId);
      if (allUserIds.includes(targetUserId)) {
        return room.roomId;
      }
    }

    // Create new DM
    const resp = await c.createRoom({
      preset: "trusted_private_chat" as sdk.Preset,
      invite: [targetUserId],
      is_direct: true,
    });

    // Update m.direct account data so the room is recognized as a DM
    try {
      const directEvent = c.getAccountData("m.direct");
      const directMap: Record<string, string[]> = directEvent
        ? { ...(directEvent.getContent() as Record<string, string[]>) }
        : {};
      if (!directMap[targetUserId]) directMap[targetUserId] = [];
      directMap[targetUserId].push(resp.room_id);
      await c.setAccountData("m.direct", directMap);
    } catch {
      // Non-critical
    }

    return resp.room_id;
  }, []);

  const createGroup = useCallback(
    async (name: string, userIds: string[]): Promise<string> => {
      const c = clientRef.current;
      if (!c) throw new Error("Not connected");
      const resp = await c.createRoom({
        name,
        preset: "private_chat" as sdk.Preset,
        invite: userIds,
      });
      return resp.room_id;
    },
    [],
  );

  const createChannel = useCallback(
    async (name: string): Promise<string> => {
      const c = clientRef.current;
      if (!c) throw new Error("Not connected");
      const resp = await c.createRoom({
        name,
        preset: "public_chat" as sdk.Preset,
        visibility: "public" as sdk.Visibility,
        room_alias_name: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      });
      return resp.room_id;
    },
    [],
  );

  const joinRoom = useCallback(async (roomIdOrAlias: string): Promise<string> => {
    const c = clientRef.current;
    if (!c) throw new Error("Not connected");
    const resp = await c.joinRoom(roomIdOrAlias);
    return resp.roomId;
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.leave(roomId);
    try { await c.forget(roomId); } catch { /* ok */ }
    refreshRooms();
  }, [refreshRooms]);

  const inviteUser = useCallback(async (roomId: string, userId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.invite(roomId, userId);
  }, []);

  const searchUsers = useCallback(
    async (term: string): Promise<{ userId: string; displayName: string }[]> => {
      const c = clientRef.current;
      if (!c) return [];
      try {
        const resp = await c.searchUserDirectory({ term, limit: 30 });
        const myId = c.getUserId();
        return resp.results
          .filter((r) => r.user_id !== myId)
          .map((r) => ({
            userId: r.user_id,
            displayName: r.display_name || r.user_id.split(":")[0].replace("@", ""),
          }));
      } catch {
        return [];
      }
    },
    [],
  );

  const addReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.sendEvent(roomId, "m.reaction", { "m.relates_to": { rel_type: "m.annotation", event_id: eventId, key: emoji } });
  }, []);

  const removeReaction = useCallback(async (roomId: string, eventId: string, emoji: string) => {
    const c = clientRef.current;
    if (!c) return;
    const room = c.getRoom(roomId);
    if (!room) return;
    const myId = c.getUserId();
    for (const e of room.getLiveTimeline().getEvents()) {
      if (e.getType() !== "m.reaction" || e.getSender() !== myId) continue;
      const rel = e.getContent()["m.relates_to"];
      if (rel?.event_id === eventId && rel?.key === emoji) { await c.redactEvent(roomId, e.getId()!); break; }
    }
  }, []);

  const forwardMessage = useCallback(async (fromRoomId: string, eventId: string, toRoomId: string) => {
    const c = clientRef.current;
    if (!c) return;
    const room = c.getRoom(fromRoomId);
    if (!room) return;
    const evt = room.getLiveTimeline().getEvents().find((e) => e.getId() === eventId);
    if (!evt) return;
    const content = evt.getContent();
    await c.sendMessage(toRoomId, { msgtype: content.msgtype || "m.text", body: content.body || "", ...(content.url ? { url: content.url } : {}), ...(content.info ? { info: content.info } : {}) });
  }, []);

  const searchMessages = useCallback(
    (roomId: string, query: string): MeshMessage[] => {
      const c = clientRef.current;
      if (!c || !query.trim()) return [];
      const room = c.getRoom(roomId);
      if (!room) return [];
      const lq = query.toLowerCase();
      return room.getLiveTimeline().getEvents()
        .map((e) => eventToMesh(e, c, room))
        .filter((m): m is MeshMessage => m !== null && m.text.toLowerCase().includes(lq));
    },
    [],
  );

  const publicRoomsCache = useRef<{ data: MeshRoom[]; ts: number }>({ data: [], ts: 0 });

  const getPublicRooms = useCallback(async (): Promise<MeshRoom[]> => {
    if (Date.now() - publicRoomsCache.current.ts < 30000) {
      return publicRoomsCache.current.data;
    }
    const c = clientRef.current;
    if (!c) return [];
    try {
      const resp = await c.publicRooms({ limit: 50 });
      const result = (resp.chunk || []).map((r) => ({
        id: r.room_id,
        name: r.name || r.canonical_alias || "Unnamed",
        avatar: getInitials(r.name || "??"),
        avatarUrl: null,
        type: "group" as const,
        lastMessage: r.topic || "",
        lastMessageTime: "",
        unread: 0,
        members: r.num_joined_members || 0,
      }));
      publicRoomsCache.current = { data: result, ts: Date.now() };
      return result;
    } catch {
      return [];
    }
  }, []);

  const value: MeshContextValue = {
    client: clientRef.current,
    ready,
    userId: session.userId,
    rooms,
    getMessages,
    sendMessage,
    sendMedia,
    deleteMessage,
    addReaction,
    removeReaction,
    forwardMessage,
    createDm,
    createGroup,
    createChannel,
    joinRoom,
    leaveRoom,
    inviteUser,
    searchUsers,
    searchMessages,
    getPublicRooms,
  };

  return (
    <MeshContext.Provider value={value}>{children}</MeshContext.Provider>
  );
}
