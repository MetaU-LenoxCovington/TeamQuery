import React from 'react';
import { chatStyles } from '../../styles/chatStyles';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isLoading: boolean;
}

const ContextButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={chatStyles.messageInput.contextButton.base}
    style={chatStyles.messageInput.contextButton.getStyle()}
    title="Add document context"
  >
    📎
  </button>
);

const SendButton: React.FC<{
  canSend: boolean;
  isLoading: boolean;
}> = ({ canSend, isLoading }) => (
  <button
    type="submit"
    disabled={!canSend || isLoading}
    className={chatStyles.messageInput.sendButton.base}
    style={chatStyles.messageInput.sendButton.getStyle(canSend, isLoading)}
    title="Send message"
  >
    {isLoading ? (
      <div className={chatStyles.loadingSpinner.base} />
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    )}
  </button>
);

export const MessageInput: React.FC<MessageInputProps & {
  onOpenContextModal: () => void;
}> = ({
  value,
  onChange,
  onKeyDown,
  textareaRef,
  isLoading,
  onOpenContextModal
}) => (
  <div className={chatStyles.messageInput.container}>
    <ContextButton onClick={onOpenContextModal} />
    <div className={chatStyles.messageInput.textareaWrapper}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about your documents..."
        className={chatStyles.messageInput.textarea.base}
        style={chatStyles.messageInput.textarea.style}
        disabled={isLoading}
      />
      <SendButton canSend={!!value.trim()} isLoading={isLoading} />
    </div>
  </div>
);
