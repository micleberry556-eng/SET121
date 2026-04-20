/**
 * MatrixProvider -- React context that holds the live Matrix client.
 *
 * After login/register the App stores a MeshlinkSession.  This provider
 * creates a MatrixClient, starts sync, and exposes helpers that the
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
  type MeshlinkSession,
  type MatrixClient,
  type Room,
  type MatrixEvent,
} from "@/lib/matrixClient";

/* ------------------------------------------------------------------ */
/*  Public types consumed by UI components                            */
/* ------------------------------------------------------------------ */

export interface MeshRoom {
  id: string;
  name: string;
  avatar: string;          // initials
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
}

/* ------------------------------------------------------------------ */
/*  Context value                                                     */
/* ------------------------------------------------------------------ */

interface MatrixContextValue {
  client: MatrixClient | null;
  ready: boolean;
  userId: string;
  rooms: MeshRoom[];
  /** Get messages for a room. */
  getMessages: (roomId: string) => MeshMessage[];
  /** Send a text message. */
  sendMessage: (roomId: string, text: string) => Promise<void>;
  /** Create a DM with another user. */
  createDm: (userId: string) => Promise<string>;
  /** Create a group room. */
  createGroup: (name: string, userIds: string[]) => Promise<string>;
  /** Join a room by ID or alias. */
  joinRoom: (roomIdOrAlias: string) => Promise<string>;
  /** Leave a room. */
  leaveRoom: (roomId: string) => Promise<void>;
  /** Search for users on the server. */
  searchUsers: (term: string) => Promise<{ userId: string; displayName: string }[]>;
}

const MatrixContext = createContext<MatrixContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useMatrix(): MatrixContextValue {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error("useMatrix must be used inside <MatrixProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function roomToMesh(room: Room, myUserId: string): MeshRoom {
  const members = room.getJoinedMembers();
  const isDm = members.length <= 2 && !room.isSpaceRoom();

  // Last event
  const timeline = room.getLiveTimeline().getEvents();
  const lastEvt = [...timeline].reverse().find(
    (e) => e.getType() === "m.room.message",
  );
  let lastMessage = "";
  let lastMessageTime = "";
  if (lastEvt) {
    const content = lastEvt.getContent();
    lastMessage = typeof content.body === "string" ? content.body : "";
    const ts = lastEvt.getTs();
    lastMessageTime = formatTime(ts);
  }

  // Room name
  let name = room.name || "Unnamed";
  if (isDm) {
    const other = members.find((m) => m.userId !== myUserId);
    if (other) name = other.name || other.userId;
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

function eventToMesh(evt: MatrixEvent, client: MatrixClient): MeshMessage | null {
  if (evt.getType() !== "m.room.message") return null;
  const content = evt.getContent();
  const senderId = evt.getSender()!;
  return {
    id: evt.getId()!,
    senderId,
    senderName: getUserDisplayName(client, senderId),
    text: typeof content.body === "string" ? content.body : "",
    timestamp: formatTime(evt.getTs()),
    isOwn: senderId === client.getUserId(),
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

export function MatrixProvider({ session, children }: Props) {
  const clientRef = useRef<MatrixClient | null>(null);
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<MeshRoom[]>([]);
  const [, setTick] = useState(0); // force re-render on events

  // Refresh room list from client state
  const refreshRooms = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const matrixRooms = c.getRooms();
    const meshRooms = matrixRooms
      .filter((r) => {
        const membership = r.getMyMembership();
        return membership === "join";
      })
      .map((r) => roomToMesh(r, session.userId))
      .sort((a, b) => {
        // Sort by most recent message
        if (!a.lastMessageTime && b.lastMessageTime) return 1;
        if (a.lastMessageTime && !b.lastMessageTime) return -1;
        return 0;
      });
    setRooms(meshRooms);
  }, [session.userId]);

  // Initialize client
  useEffect(() => {
    let cancelled = false;
    const client = createClient(session);
    clientRef.current = client;

    const onEvent = () => {
      if (!cancelled) {
        refreshRooms();
        setTick((t) => t + 1);
      }
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
      client.removeAllListeners();
      stopClient(client);
      clientRef.current = null;
    };
  }, [session, refreshRooms]);

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

  const createDm = useCallback(async (targetUserId: string): Promise<string> => {
    const c = clientRef.current;
    if (!c) throw new Error("Not connected");
    const resp = await c.createRoom({
      preset: "trusted_private_chat" as sdk.Preset,
      invite: [targetUserId],
      is_direct: true,
    });
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
    refreshRooms();
  }, [refreshRooms]);

  const searchUsers = useCallback(
    async (term: string): Promise<{ userId: string; displayName: string }[]> => {
      const c = clientRef.current;
      if (!c) return [];
      try {
        const resp = await c.searchUserDirectory({ term, limit: 20 });
        return resp.results.map((r) => ({
          userId: r.user_id,
          displayName: r.display_name || r.user_id,
        }));
      } catch {
        return [];
      }
    },
    [],
  );

  const value: MatrixContextValue = {
    client: clientRef.current,
    ready,
    userId: session.userId,
    rooms,
    getMessages,
    sendMessage,
    createDm,
    createGroup,
    joinRoom,
    leaveRoom,
    searchUsers,
  };

  return (
    <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>
  );
}
