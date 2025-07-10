import React from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { DocumentContextModal } from './DocumentContextModal';
import { useChat } from '../../hooks/chat';

interface ChatAreaProps {
  // TODO: Add props when integrating with API
}

export const ChatArea: React.FC<ChatAreaProps> = () => {
  const {
    messages,
    selectedContext,
    isContextModalOpen,
    isLoading,
    handleSendMessage,
    handleOpenContextModal,
    handleCloseContextModal,
    handleSelectContext,
  } = useChat();

  return (
    <div className="flex-1 flex flex-col">
      <ChatMessages messages={messages} />

      <ChatInput
        onSendMessage={handleSendMessage}
        onOpenContextModal={handleOpenContextModal}
        selectedContext={selectedContext}
        isLoading={isLoading}
      />

      {isContextModalOpen && (
        <DocumentContextModal
          isOpen={isContextModalOpen}
          onClose={handleCloseContextModal}
          onSelectContext={handleSelectContext}
          selectedContext={selectedContext}
        />
      )}
    </div>
  );
};
