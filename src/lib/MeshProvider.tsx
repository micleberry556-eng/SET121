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
  sendMessage: (roomId: string, text: string) => Promise<void>;
  sendMedia: (roomId: string, file: File) => Promise<void>;
  deleteMessage: (roomId: string, eventId: string) => Promise<void>;
  createDm: (userId: string) => Promise<string>;
  createGroup: (name: string, userIds: string[]) => Promise<string>;
  createChannel: (name: string) => Promise<string>;
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  leaveRoom: (roomId: string) => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  searchUsers: (term: string) => Promise<{ userId: string; displayName: string }[]>;
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

function eventToMesh(evt: MeshEvent, client: MeshClient): MeshMessage | null {
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

  return {
    id: evt.getId()!,
    senderId,
    senderName: getUserDisplayName(client, senderId),
    text,
    timestamp: formatTime(evt.getTs()),
    isOwn: senderId === client.getUserId(),
    mediaUrl,
    mediaType,
    mediaName,
    mediaSize,
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
        .map((e) => eventToMesh(e, c))
        .filter((m): m is MeshMessage => m !== null);
    },
    [],
  );

  const sendMessage = useCallback(async (roomId: string, text: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.sendTextMessage(roomId, text);
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
    createDm,
    createGroup,
    createChannel,
    joinRoom,
    leaveRoom,
    inviteUser,
    searchUsers,
    getPublicRooms,
  };

  return (
    <MeshContext.Provider value={value}>{children}</MeshContext.Provider>
  );
}
