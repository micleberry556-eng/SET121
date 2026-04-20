import { useState, useEffect, useCallback } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { AccountSettings } from "@/components/AccountSettings";
import { CallScreen, CallType } from "@/components/CallScreen";
import { GroupSettingsDialog } from "@/components/GroupSettingsDialog";
import {
  contacts as defaultContacts, defaultProfile,
  Chat, Message, MediaAttachment, Story, StoryItem, UserProfile, Topic,
} from "@/data/mockData";
import { useMatrix, type MeshRoom, type MeshMessage } from "@/lib/MatrixProvider";

interface IndexProps {
  initialProfile?: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
  onLogout?: () => void;
}

/** Convert Matrix rooms to the Chat[] format the existing UI expects. */
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
    })),
  };
}

const Index = ({ initialProfile, onProfileChange, onLogout }: IndexProps = {}) => {
  const matrix = useMatrix();

  const [stories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<UserProfile>(initialProfile || defaultProfile);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>("audio");
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);

  // Build chat list from Matrix rooms
  const chatList: Chat[] = matrix.rooms.map((room) => {
    const messages = matrix.getMessages(room.id);
    return meshRoomToChat(room, messages);
  });

  const selectedChat = chatList.find((c) => c.id === selectedChatId) ?? null;

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = useCallback(async (chatId: string, text: string, _media?: MediaAttachment[], _topicId?: string | null) => {
    if (!text.trim()) return;
    await matrix.sendMessage(chatId, text.trim());
  }, [matrix]);

  const handleCreateChat = useCallback(async (chat: Chat) => {
    // Create a new room on the Matrix server
    try {
      let roomId: string;
      if (chat.type === "dm") {
        // For DM, we need a user ID. The chat.name might be a username.
        // Try to search for the user first
        const users = await matrix.searchUsers(chat.name);
        if (users.length > 0) {
          roomId = await matrix.createDm(users[0].userId);
        } else {
          // Try as a direct user ID
          roomId = await matrix.createDm(chat.name);
        }
      } else {
        roomId = await matrix.createGroup(chat.name, []);
      }
      setSelectedChatId(roomId);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, [matrix]);

  const handleAddStory = (_items: StoryItem[]) => {
    // Stories not yet implemented with Matrix
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
    // Room updates handled by Matrix sync
  };

  const handleDeleteChat = useCallback(async (chatId: string) => {
    await matrix.leaveRoom(chatId);
    if (selectedChatId === chatId) setSelectedChatId(null);
  }, [matrix, selectedChatId]);

  const handleBack = () => setSidebarOpen(true);

  // Show loading while Matrix syncs
  if (!matrix.ready) {
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
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onAddStory={handleAddStory}
          onOpenSettings={() => setSettingsOpen(true)}
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
          onClose={() => setGroupSettingsOpen(false)}
          onUpdateChat={handleUpdateChat}
          onDeleteChat={handleDeleteChat}
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
