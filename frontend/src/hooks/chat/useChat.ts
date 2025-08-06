import { useState, useCallback, useEffect } from 'react';
import { Message } from '../../types';
import { chatService } from '../../services/chatService';
import { useAuthContext } from '../../contexts/AuthContext';


export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  handleSendMessage: (content: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  clearError: () => void;
  clearChat: () => void;
}

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useAuthContext();

  // Load initial messages - TODO: Implement chat history persistence on backend
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

  const handleSendMessage = useCallback(async (content: string) => {
    // Check if organization is available
    if (!currentOrganization) {
      setError('No organization selected. Please select an organization to continue.');
      return;
    }

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
      // Format conversation history as a single string for the LLM
      let formattedQuery = content;
      
      if (messages.length > 0) {
        const conversationContext = messages
          .map(msg => {
            const role = msg.type === 'user' ? 'Human' : 'Assistant';
            return `${role}: ${msg.content}`;
          })
          .join('\n\n');
        
        formattedQuery = `Previous conversation context:\n${conversationContext}\n\nCurrent query: ${content}`;
      }

      const aiMessage = await chatService.sendMessage({
        content: formattedQuery,
        organizationId: currentOrganization.id
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
  }, [currentOrganization, messages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    handleSendMessage,
    setMessages,
    clearError,
    clearChat,
  };
};
