import { useState, useCallback, useEffect } from 'react';
import { Message } from '../../types';
import { chatService } from '../../services/chatService';

export interface UseChatReturn {
  messages: Message[];
  selectedContext: string[];
  isContextModalOpen: boolean;
  isLoading: boolean;
  error: string | null;
  handleSendMessage: (content: string, contextIds?: string[]) => Promise<void>;
  handleOpenContextModal: () => void;
  handleCloseContextModal: () => void;
  handleSelectContext: (contextIds: string[]) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  clearError: () => void;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const initialMessages = await chatService.getMessages();
        setMessages(initialMessages);
      } catch (err) {
        console.error('Error loading messages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    };

    loadMessages();
  }, []);

  const handleSendMessage = useCallback(async (content: string, contextIds?: string[]) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const aiMessage = await chatService.sendMessage({
        content,
        contextIds,
        // TODO: Add organizationId when available
        // organizationId: currentOrganization.id
      });

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);

      // Remove the user message if sending failed
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOpenContextModal = useCallback(() => {
    setIsContextModalOpen(true);
  }, []);

  const handleCloseContextModal = useCallback(() => {
    setIsContextModalOpen(false);
  }, []);

  const handleSelectContext = useCallback((contextIds: string[]) => {
    setSelectedContext(contextIds);
    setIsContextModalOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    selectedContext,
    isContextModalOpen,
    isLoading,
    error,
    handleSendMessage,
    handleOpenContextModal,
    handleCloseContextModal,
    handleSelectContext,
    setMessages,
    clearError,
  };
};
