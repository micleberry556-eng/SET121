import { useState, useCallback } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { AccountSettings } from "@/components/AccountSettings";
import { CallScreen, CallType } from "@/components/CallScreen";
import { GroupSettingsDialog } from "@/components/GroupSettingsDialog";
import { DmSettingsDialog } from "@/components/DmSettingsDialog";
import {
  contacts as defaultContacts, defaultProfile,
  Chat, Message, MediaAttachment, Story, StoryItem, UserProfile, Topic, ChatFolder,
} from "@/data/mockData";
import { useMesh, type MeshRoom, type MeshMessage } from "@/lib/MeshProvider";

interface IndexProps {
  initialProfile?: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
  onLogout?: () => void;
}

/** Convert server rooms to the Chat[] format the existing UI expects. */
function meshRoomToChat(room: MeshRoom, messages: MeshMessage[]): Chat {
  return {
    id: room.id,
    name: room.name,
    avatar: room.avatar,
    avatarUrl: room.avatarUrl,
    type: room.type,
    online: false,
    lastMessage: room.lastMessage,
    lastMessageTime: room.lastMessageTime,
    unread: room.unread,
    pinned: false,
    members: room.members,
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.isOwn ? "me" : m.senderId,
      text: m.text,
      timestamp: m.timestamp,
      read: true,
      media: m.mediaUrl ? [{
        id: m.id + "-media",
        type: m.mediaType || "image",
        name: m.mediaName || "file",
        url: m.mediaUrl,
        size: 0,
        mimeType: m.mediaType === "video" ? "video/mp4" : m.mediaType === "audio" ? "audio/mpeg" : "image/jpeg",
      }] : undefined,
    })),
  };
}

const Index = ({ initialProfile, onProfileChange, onLogout }: IndexProps = {}) => {
  const mesh = useMesh();

  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<UserProfile>(initialProfile || defaultProfile);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>("audio");
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [dmSettingsOpen, setDmSettingsOpen] = useState(false);
  const [folders, setFolders] = useState<ChatFolder[]>([
    { id: "fav-default", name: "Favorites", chatIds: [] },
  ]);

  // Build chat list from server rooms
  const chatList: Chat[] = mesh.rooms.map((room) => {
    const messages = mesh.getMessages(room.id);
    return meshRoomToChat(room, messages);
  });

  const selectedChat = chatList.find((c) => c.id === selectedChatId) ?? null;

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = useCallback(async (chatId: string, text: string, media?: MediaAttachment[], _topicId?: string | null) => {
    // Send media files first
    if (media && media.length > 0) {
      for (const attachment of media) {
        try {
          // Convert blob URL back to File
          const resp = await fetch(attachment.url);
          const blob = await resp.blob();
          const file = new File([blob], attachment.name, { type: attachment.mimeType });
          await mesh.sendMedia(chatId, file);
        } catch (err) {
          console.error("Failed to send media:", err);
        }
      }
    }
    // Send text if any
    if (text.trim()) {
      await mesh.sendMessage(chatId, text.trim());
    }
  }, [mesh]);

  const handleCreateChat = useCallback(async (chat: Chat) => {
    try {
      let roomId: string;
      if (chat.type === "dm") {
        const users = await mesh.searchUsers(chat.name);
        if (users.length > 0) {
          roomId = await mesh.createDm(users[0].userId);
        } else {
          roomId = await mesh.createDm(chat.name);
        }
      } else if (chat.type === "channel") {
        roomId = await mesh.createChannel(chat.name);
      } else {
        roomId = await mesh.createGroup(chat.name, []);
      }
      setSelectedChatId(roomId);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, [mesh]);

  const handleAddStory = (items: StoryItem[]) => {
    const existing = stories.find((s) => s.userId === "me");
    if (existing) {
      setStories((prev) =>
        prev.map((s) => s.userId === "me" ? { ...s, items: [...s.items, ...items] } : s),
      );
    } else {
      setStories((prev) => [
        { id: `story-${Date.now()}`, userId: "me", userName: profile.name, avatar: profile.avatarInitials, items, viewed: true },
        ...prev,
      ]);
    }
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    onProfileChange?.(updated);
  };

  const handleCall = (type: CallType) => {
    setCallType(type);
    setCallOpen(true);
  };

  const handleUpdateChat = (_updated: Chat) => {
    // Room updates handled by server sync
  };

  const handleDeleteChat = useCallback(async (chatId: string) => {
    await mesh.leaveRoom(chatId);
    if (selectedChatId === chatId) setSelectedChatId(null);
  }, [mesh, selectedChatId]);

  const handleBlockUser = (chatId: string) => {
    // Block handled locally for now
    const chat = chatList.find((c) => c.id === chatId);
    if (chat) {
      console.log(`Blocked user in chat: ${chat.name}`);
    }
  };

  const handleBack = () => setSidebarOpen(true);

  // Show loading while connecting
  if (!mesh.ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl gradient-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Connecting to Meshlink...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className={`${sidebarOpen ? "flex" : "hidden"} md:flex w-full md:w-auto flex-shrink-0`}>
        <ChatSidebar
          chats={chatList}
          stories={stories}
          profile={profile}
          folders={folders}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onAddStory={handleAddStory}
          onOpenSettings={() => setSettingsOpen(true)}
          onFoldersChange={setFolders}
        />
      </div>
      <div className={`${!sidebarOpen ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
        {selectedChat ? (
          <ChatView
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            onBack={handleBack}
            onCall={selectedChat.type !== "channel" ? handleCall : undefined}
            onSettingsClick={
              selectedChat.type === "group" || selectedChat.type === "channel"
                ? () => setGroupSettingsOpen(true)
                : undefined
            }
            onDmSettingsClick={
              selectedChat.type === "dm" ? () => setDmSettingsOpen(true) : undefined
            }
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      {selectedChat && (selectedChat.type === "group" || selectedChat.type === "channel") && (
        <GroupSettingsDialog
          open={groupSettingsOpen}
          chat={selectedChat}
          contacts={defaultContacts}
          folders={folders}
          onClose={() => setGroupSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
          onFoldersChange={setFolders}
        />
      )}

      {selectedChat && selectedChat.type === "dm" && (
        <DmSettingsDialog
          open={dmSettingsOpen}
          chat={selectedChat}
          folders={folders}
          onClose={() => setDmSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
          onFoldersChange={setFolders}
          onBlockUser={handleBlockUser}
        />
      )}

      <AccountSettings
        open={settingsOpen}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onUpdate={handleUpdateProfile}
        onLogout={() => { setSettingsOpen(false); onLogout?.(); }}
      />

      {selectedChat && (
        <CallScreen
          open={callOpen}
          type={callType}
          contactName={selectedChat.name}
          contactAvatar={selectedChat.avatar}
          onEnd={() => setCallOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;
