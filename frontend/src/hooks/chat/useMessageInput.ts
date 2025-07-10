import { useState, useRef, useCallback } from 'react';

export interface UseMessageInputReturn {
  message: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetInput: () => void;
}

export interface UseMessageInputOptions {
  onSendMessage: (message: string, selectedContext?: string[]) => void;
  selectedContext: string[];
  isLoading: boolean;
}

export const useMessageInput = ({
  onSendMessage,
  selectedContext,
  isLoading,
}: UseMessageInputOptions): UseMessageInputReturn => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(
        message.trim(),
        selectedContext.length > 0 ? selectedContext : undefined
      );
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, isLoading, onSendMessage, selectedContext]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleInputChange = useCallback((value: string) => {
    setMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  const resetInput = useCallback(() => {
    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  return {
    message,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    handleSubmit,
    resetInput,
  };
};
