import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { InviteMembersDialog } from "@/components/InviteMembersDialog";
import { AccountSettings } from "@/components/AccountSettings";
import { CallScreen, CallType } from "@/components/CallScreen";
import {
  chats as initialChats, contacts, defaultProfile,
  Chat, Message, MediaAttachment, Story, StoryItem, UserProfile,
} from "@/data/mockData";

const initialStories: Story[] = [
  {
    id: "s1",
    userId: "alice",
    userName: "Alice Nakamoto",
    avatar: "AN",
    items: [
      { id: "si1", type: "image", url: "https://picsum.photos/seed/mesh1/800/1200", caption: "New relay node deployed", timestamp: "2h ago" },
    ],
    viewed: false,
  },
  {
    id: "s2",
    userId: "bob",
    userName: "Bob Chen",
    avatar: "BC",
    items: [
      { id: "si2", type: "image", url: "https://picsum.photos/seed/mesh2/800/1200", caption: "QUIC upgrade testing", timestamp: "4h ago" },
    ],
    viewed: true,
  },
];

interface IndexProps {
  initialProfile?: UserProfile;
  onProfileChange?: (p: UserProfile) => void;
}

const Index = ({ initialProfile, onProfileChange }: IndexProps = {}) => {
  const [chatList, setChatList] = useState<Chat[]>(initialChats);
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [profile, setProfile] = useState<UserProfile>(initialProfile || defaultProfile);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>("audio");

  const selectedChat = chatList.find((c) => c.id === selectedChatId) ?? null;

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setChatList((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? { ...chat, unread: 0, messages: chat.messages.map((m) => ({ ...m, read: true })) }
          : chat,
      ),
    );
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSendMessage = (chatId: string, text: string, media?: MediaAttachment[]) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: "me",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
      media,
    };
    const lastMsg = media && media.length > 0 && !text
      ? `[${media[0].type === "image" ? "Photo" : media[0].type === "video" ? "Video" : "Audio"}]`
      : text;
    setChatList((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, newMessage], lastMessage: lastMsg, lastMessageTime: "now" }
          : chat,
      ),
    );
  };

  const handleCreateChat = (chat: Chat) => {
    setChatList((prev) => [chat, ...prev]);
    setSelectedChatId(chat.id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

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

  const handleInvite = (chatId: string, contactIds: string[]) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const invited = contactIds.map((id) => contacts.find((c) => c.id === id)).filter(Boolean);
    const names = invited.map((c) => c!.name).join(", ");
    const isChannel = chatList.find((c) => c.id === chatId)?.type === "channel";
    const systemMsg: Message = {
      id: `msg-${Date.now()}`,
      senderId: "system",
      text: isChannel
        ? `${names} ${invited.length === 1 ? "was" : "were"} invited to subscribe`
        : `${names} ${invited.length === 1 ? "was" : "were"} added to the group`,
      timestamp: now,
      read: true,
    };
    setChatList((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              memberIds: [...(chat.memberIds || []), ...contactIds],
              members: (chat.members || 0) + contactIds.length,
              messages: [...chat.messages, systemMsg],
              lastMessage: systemMsg.text,
              lastMessageTime: "now",
            }
          : chat,
      ),
    );
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    onProfileChange?.(updated);
  };

  const handleCall = (type: CallType) => {
    setCallType(type);
    setCallOpen(true);
  };

  const handleBack = () => setSidebarOpen(true);

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
            onInviteClick={
              selectedChat.type === "group" || selectedChat.type === "channel"
                ? () => setInviteOpen(true)
                : undefined
            }
            onCall={selectedChat.type !== "channel" ? handleCall : undefined}
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      {selectedChat && (selectedChat.type === "group" || selectedChat.type === "channel") && (
        <InviteMembersDialog
          open={inviteOpen}
          chat={selectedChat}
          contacts={contacts}
          onClose={() => setInviteOpen(false)}
          onInvite={handleInvite}
        />
      )}

      <AccountSettings
        open={settingsOpen}
        profile={profile}
        onClose={() => setSettingsOpen(false)}
        onUpdate={handleUpdateProfile}
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
