import React from 'react';
import { useMessageInput } from '../../hooks/chat';
import { MessageInput } from './MessageInput';
import { chatStyles } from '../../styles/chatStyles';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const InputHints: React.FC = () => (
  <div className={chatStyles.messageInput.hints}>
    Press Enter to send, Shift+Enter for new line
  </div>
);

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
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
    isLoading,
  });

  return (
    <div className={chatStyles.chatInput.container.base} style={chatStyles.chatInput.container.style}>
      <form onSubmit={handleSubmit}>
        <MessageInput
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          textareaRef={textareaRef}
          isLoading={isLoading}
        />
      </form>

      <InputHints />
    </div>
  );
};
