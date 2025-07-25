import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useChat } from '../../hooks/chat';

interface ChatAreaProps {
  // TODO: Add props when integrating with API
}

export const ChatArea: React.FC<ChatAreaProps> = () => {
  const {
    messages,
    isLoading,
    handleSendMessage,
  } = useChat();

  return (
    <div className="flex-1 flex flex-col">
      <ChatMessages messages={messages} />

      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  );
};
