import { useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatView } from "@/components/ChatView";
import { EmptyChat } from "@/components/EmptyChat";
import { chats as initialChats, Chat, Message } from "@/data/mockData";

const Index = () => {
  const [chatList, setChatList] = useState<Chat[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectedChat = chatList.find((c) => c.id === selectedChatId) ?? null;

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    // On mobile, close sidebar when chat is selected
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSendMessage = (chatId: string, text: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: "me",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };

    setChatList((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, newMessage],
              lastMessage: text,
              lastMessageTime: "now",
            }
          : chat,
      ),
    );
  };

  const handleBack = () => {
    setSidebarOpen(true);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar: always visible on md+, toggled on mobile */}
      <div
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex w-full md:w-auto flex-shrink-0`}
      >
        <ChatSidebar
          chats={chatList}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
        />
      </div>

      {/* Chat area: always visible on md+, toggled on mobile */}
      <div
        className={`${
          !sidebarOpen ? "flex" : "hidden"
        } md:flex flex-1 min-w-0`}
      >
        {selectedChat ? (
          <ChatView
            chat={selectedChat}
            onSendMessage={handleSendMessage}
            onBack={handleBack}
          />
        ) : (
          <EmptyChat />
        )}
      </div>
    </div>
  );
};

export default Index;
