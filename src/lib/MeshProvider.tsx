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

function roomToMesh(room: SdkRoom, myUserId: string): MeshRoom {
  const members = room.getJoinedMembers();
  const isDm = members.length <= 2 && !room.isSpaceRoom();

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

function eventToMesh(evt: MeshEvent, client: MeshClient): MeshMessage | null {
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

export function MeshProvider({ session, children }: Props) {
  const clientRef = useRef<MeshClient | null>(null);
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<MeshRoom[]>([]);
  const [, setTick] = useState(0);

  const refreshRooms = useCallback(() => {
    const c = clientRef.current;
    if (!c) return;
    const allRooms = c.getRooms();
    const meshRooms = allRooms
      .filter((r) => r.getMyMembership() === "join")
      .map((r) => roomToMesh(r, session.userId))
      .sort((a, b) => {
        if (!a.lastMessageTime && b.lastMessageTime) return 1;
        if (a.lastMessageTime && !b.lastMessageTime) return -1;
        return 0;
      });
    setRooms(meshRooms);
  }, [session.userId]);

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
    // Forget the room so server can purge its data
    try {
      await c.forget(roomId);
    } catch {
      /* room may already be forgotten */
    }
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

  const inviteUser = useCallback(async (roomId: string, userId: string) => {
    const c = clientRef.current;
    if (!c) return;
    await c.invite(roomId, userId);
  }, []);

  const getPublicRooms = useCallback(async (): Promise<MeshRoom[]> => {
    const c = clientRef.current;
    if (!c) return [];
    try {
      const resp = await c.publicRooms({ limit: 50 });
      return (resp.chunk || []).map((r) => ({
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
