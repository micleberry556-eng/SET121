export interface MediaAttachment {
  id: string;
  type: "image" | "video" | "audio";
  name: string;
  url: string;       // blob URL or data URL
  size: number;       // bytes
  mimeType: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
  media?: MediaAttachment[];
  topicId?: string | null;
}

export interface Topic {
  id: string;
  name: string;
  icon: string;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: string;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  type: "dm" | "group" | "channel";
  online?: boolean;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  pinned?: boolean;
  members?: number;
  memberIds?: string[];
  description?: string;
  topics?: Topic[];
  messages: Message[];
}

export interface ChatFolder {
  id: string;
  name: string;
  chatIds: string[];
}

export interface StoryItem {
  id: string;
  type: "image" | "video";
  url: string;
  caption?: string;
  timestamp: string;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  items: StoryItem[];
  viewed: boolean;
}

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  avatarInitials: string;
  peerId: string;
  privacy: {
    lastSeen: "everyone" | "contacts" | "nobody";
    profilePhoto: "everyone" | "contacts" | "nobody";
    forwarding: "everyone" | "contacts" | "nobody";
    calls: "everyone" | "contacts" | "nobody";
    groups: "everyone" | "contacts" | "nobody";
    readReceipts: boolean;
    onlineStatus: boolean;
  };
}

export const defaultProfile: UserProfile = {
  name: "Anonymous",
  username: "anon_mesh",
  bio: "Decentralized by default",
  avatarUrl: null,
  avatarInitials: "ME",
  peerId: "peer:7f3a...e9b1",
  privacy: {
    lastSeen: "everyone",
    profilePhoto: "everyone",
    forwarding: "everyone",
    calls: "everyone",
    groups: "contacts",
    readReceipts: true,
    onlineStatus: true,
  },
};

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  peerId: string;
}

export const contacts: Contact[] = [
  { id: "alice", name: "Alice Nakamoto", avatar: "AN", online: true, peerId: "peer:a1b2...c3d4" },
  { id: "bob", name: "Bob Chen", avatar: "BC", online: true, peerId: "peer:e5f6...g7h8" },
  { id: "carol", name: "Carol Rivera", avatar: "CR", online: false, peerId: "peer:i9j0...k1l2" },
  { id: "dave", name: "Dave Kim", avatar: "DK", online: true, peerId: "peer:m3n4...o5p6" },
  { id: "eve", name: "Eve Torres", avatar: "ET", online: false, peerId: "peer:q7r8...s9t0" },
  { id: "frank", name: "Frank Zhao", avatar: "FZ", online: true, peerId: "peer:u1v2...w3x4" },
  { id: "grace", name: "Grace Okafor", avatar: "GO", online: false, peerId: "peer:y5z6...a7b8" },
  { id: "hiro", name: "Hiro Tanaka", avatar: "HT", online: true, peerId: "peer:c9d0...e1f2" },
];

const ME = "me";

export const chats: Chat[] = [
  {
    id: "1",
    name: "Alice Nakamoto",
    avatar: "AN",
    type: "dm",
    online: true,
    lastMessage: "The relay node is syncing perfectly now",
    lastMessageTime: "2m",
    unread: 2,
    pinned: true,
    messages: [
      { id: "m1", senderId: "alice", text: "Hey, did you check the CRDT merge on the staging relay?", timestamp: "10:02 AM", read: true },
      { id: "m2", senderId: ME, text: "Yeah, ran it last night. Got some conflicts on the vector clocks though.", timestamp: "10:05 AM", read: true },
      { id: "m3", senderId: "alice", text: "That's expected for concurrent edits. Did the LWW fallback kick in?", timestamp: "10:06 AM", read: true },
      { id: "m4", senderId: ME, text: "It did. Merged cleanly after the second pass. I pushed the fix to the crdt crate.", timestamp: "10:10 AM", read: true },
      { id: "m5", senderId: "alice", text: "Nice! I'll pull and test with the 3-node mesh.", timestamp: "10:12 AM", read: true },
      { id: "m6", senderId: "alice", text: "The relay node is syncing perfectly now", timestamp: "10:30 AM", read: false },
      { id: "m7", senderId: "alice", text: "We should deploy to the testnet cluster next", timestamp: "10:31 AM", read: false },
    ],
  },
  {
    id: "2",
    name: "Core Dev Team",
    avatar: "CD",
    type: "group",
    lastMessage: "Bob: Pushed the libp2p QUIC upgrade",
    lastMessageTime: "15m",
    unread: 5,
    members: 8,
    memberIds: ["me", "bob", "carol", "alice", "dave"],
    topics: [
      { id: "general", name: "General", icon: "#", messageCount: 4, lastMessage: "Let's run the fault sim tests", lastMessageTime: "15m" },
      { id: "backend", name: "Backend", icon: "🔧", messageCount: 0, lastMessage: "Topic created", lastMessageTime: "1d" },
      { id: "ideas", name: "Ideas", icon: "💡", messageCount: 0, lastMessage: "Topic created", lastMessageTime: "2d" },
    ],
    messages: [
      { id: "m1", senderId: "bob", text: "Pushed the libp2p QUIC upgrade to the relay crate", timestamp: "9:45 AM", read: true, topicId: "general" },
      { id: "m2", senderId: "carol", text: "Does it handle NAT traversal for symmetric NATs now?", timestamp: "9:48 AM", read: true, topicId: "general" },
      { id: "m3", senderId: "bob", text: "Yes, added hole-punching via the DCUtR protocol", timestamp: "9:50 AM", read: true, topicId: "general" },
      { id: "m4", senderId: ME, text: "Great work. Let's run the fault sim tests before merging.", timestamp: "9:55 AM", read: true, topicId: "general" },
    ],
  },
  {
    id: "3",
    name: "# releases",
    avatar: "RE",
    type: "channel",
    lastMessage: "v0.3.0-alpha released with E2EE group chats",
    lastMessageTime: "1h",
    unread: 0,
    members: 142,
    memberIds: ["me", "alice", "bob", "carol", "dave", "eve"],
    messages: [
      { id: "m1", senderId: "system", text: "v0.3.0-alpha released\n\n- E2EE group chats (X3DH + Double Ratchet)\n- CRDT-based message ordering\n- File sharing via encrypted IPFS blobs\n- selfdeploy CLI v0.2", timestamp: "9:00 AM", read: true },
    ],
  },
  {
    id: "4",
    name: "Eve Torres",
    avatar: "ET",
    type: "dm",
    online: false,
    lastMessage: "Let me check the TURN server logs",
    lastMessageTime: "3h",
    unread: 0,
    messages: [
      { id: "m1", senderId: ME, text: "Voice calls are dropping after ~30s on the staging relay", timestamp: "7:00 AM", read: true },
      { id: "m2", senderId: "eve", text: "Could be a TURN allocation timeout. What's the config?", timestamp: "7:15 AM", read: true },
      { id: "m3", senderId: ME, text: "Default coturn settings, 300s lifetime", timestamp: "7:16 AM", read: true },
      { id: "m4", senderId: "eve", text: "Let me check the TURN server logs", timestamp: "7:20 AM", read: true },
    ],
  },
  {
    id: "5",
    name: "# security-audit",
    avatar: "SA",
    type: "channel",
    lastMessage: "CVE scan passed - 0 critical findings",
    lastMessageTime: "5h",
    unread: 0,
    members: 23,
    memberIds: ["me", "frank", "grace"],
    messages: [
      { id: "m1", senderId: "secbot", text: "Weekly Security Report\n\nSAST: 0 high, 2 medium\nSCA: 0 critical CVEs\nDependency audit: all clear\nBinary signatures: verified", timestamp: "6:00 AM", read: true },
    ],
  },
  {
    id: "6",
    name: "Mesh Network Lab",
    avatar: "ML",
    type: "group",
    lastMessage: "Dave: 50-node simulation completed",
    lastMessageTime: "1d",
    unread: 0,
    members: 12,
    memberIds: ["me", "dave", "hiro"],
    topics: [
      { id: "general", name: "General", icon: "#", messageCount: 3, lastMessage: "Healed in under 2s", lastMessageTime: "1d" },
      { id: "simulations", name: "Simulations", icon: "🚀", messageCount: 0, lastMessage: "Topic created", lastMessageTime: "3d" },
    ],
    messages: [
      { id: "m1", senderId: "dave", text: "50-node simulation completed. Average convergence: 340ms", timestamp: "Yesterday", read: true, topicId: "general" },
      { id: "m2", senderId: ME, text: "That's within our SLA target. What about partition healing?", timestamp: "Yesterday", read: true, topicId: "general" },
      { id: "m3", senderId: "dave", text: "Healed in under 2s for all tested topologies", timestamp: "Yesterday", read: true, topicId: "general" },
    ],
  },
];
