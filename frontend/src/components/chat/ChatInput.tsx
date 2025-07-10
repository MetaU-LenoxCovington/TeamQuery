import React from 'react';
import { useMessageInput } from '../../hooks/chat';
import { ContextDisplay } from './ContextDisplay';
import { MessageInput } from './MessageInput';
import { chatStyles } from '../../styles/chatStyles';

interface ChatInputProps {
  onSendMessage: (message: string, selectedContext?: string[]) => void;
  onOpenContextModal: () => void;
  selectedContext: string[];
  isLoading?: boolean;
}

const InputHints: React.FC = () => (
  <div className={chatStyles.messageInput.hints}>
    Press Enter to send, Shift+Enter for new line
  </div>
);

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onOpenContextModal,
  selectedContext,
  isLoading = false,
}) => {
  const {
    message,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    handleSubmit,
  } = useMessageInput({
    onSendMessage,
    selectedContext,
    isLoading,
  });

  const handleRemoveContext = (contextId: string) => {
    // TODO: Implement context removal
  };

  return (
    <div className={chatStyles.chatInput.container.base} style={chatStyles.chatInput.container.style}>
      <ContextDisplay
        selectedContext={selectedContext}
        onRemoveContext={handleRemoveContext}
      />

      <form onSubmit={handleSubmit}>
        <MessageInput
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          isLoading={isLoading}
          onOpenContextModal={onOpenContextModal}
        />
      </form>

      <InputHints />
    </div>
  );
};
