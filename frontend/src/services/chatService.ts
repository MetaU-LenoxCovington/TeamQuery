import { ApiError } from './api';
import { Message } from '../types';

export interface SendMessageRequest {
  content: string;
  contextIds?: string[];
  organizationId?: string;
}

export interface SendMessageResponse {
  message: Message;
}

export interface GetMessagesResponse {
  messages: Message[];
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: string;
  preview: string;
}

export interface GetChatHistoryResponse {
  chats: ChatHistoryItem[];
}

// TODO: Remove when real API is implemented
const mockMessages: Message[] = [
  {
    id: 'msg-1',
    type: 'user',
    content: 'What are the safety protocols for building maintenance?',
    timestamp: new Date('2024-01-15T10:30:00'),
  },
  {
    id: 'msg-2',
    type: 'assistant',
    content: 'Based on the safety manual and building maintenance protocols, here are the key safety requirements for building maintenance:\n\n1. **Personal Protective Equipment (PPE)**\n   - Hard hats must be worn in all construction areas\n   - Safety goggles required when using power tools\n   - Non-slip footwear mandatory\n\n2. **Electrical Safety**\n   - Always turn off power at the breaker before electrical work\n   - Use lockout/tagout procedures\n   - Test circuits before beginning work\n\n3. **Fall Protection**\n   - Safety harnesses required for work above 6 feet\n   - Inspect ladders before each use\n   - Maintain 3-point contact when climbing',
    timestamp: new Date('2024-01-15T10:30:30'),
    sources: [
      {
        id: 'source-1',
        title: 'Building Safety Manual.pdf',
        type: 'document',
        excerpt: 'Personal protective equipment must be worn at all times during maintenance operations...'
      },
      {
        id: 'source-2',
        title: 'Electrical Safety Protocols.pdf',
        type: 'document',
        excerpt: 'Lockout/tagout procedures are mandatory for all electrical maintenance work...'
      }
    ]
  },
  {
    id: 'msg-3',
    type: 'user',
    content: 'How often should fire extinguishers be inspected?',
    timestamp: new Date('2024-01-15T10:35:00'),
  }
];

const mockChatHistory: ChatHistoryItem[] = [
  {
    id: 'chat-1',
    title: 'Building Safety Protocols',
    timestamp: '2024-01-15T10:30:00',
    preview: 'What are the safety protocols for building maintenance?'
  },
  {
    id: 'chat-2',
    title: 'Fire Safety Guidelines',
    timestamp: '2024-01-14T14:20:00',
    preview: 'Can you explain the fire evacuation procedures?'
  },
  {
    id: 'chat-3',
    title: 'Maintenance Schedule',
    timestamp: '2024-01-13T09:15:00',
    preview: 'What is the regular maintenance schedule for HVAC systems?'
  }
];

class ChatService {
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.post<SendMessageResponse>('/api/chat/messages', request);
      // return response.message;

      return new Promise((resolve) => {
        setTimeout(() => {
          const aiMessage: Message = {
            id: `msg-${Date.now()}`,
            type: 'assistant',
            content: 'I understand your question. Let me search through the relevant documents to provide you with an accurate answer.',
            timestamp: new Date(),
            sources: request.contextIds ? [
              {
                id: 'context-source-1',
                title: 'Selected Document.pdf',
                type: 'document',
                excerpt: 'Relevant excerpt from the selected context...'
              }
            ] : undefined
          };
          resolve(aiMessage);
        }, 1500);
      });

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  async getMessages(): Promise<Message[]> {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.get<GetMessagesResponse>('/api/chat/messages');
      // return response.messages;

      return Promise.resolve(mockMessages);

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  async getChatHistory(): Promise<ChatHistoryItem[]> {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.get<GetChatHistoryResponse>('/api/chat/history');
      // return response.chats;

      return Promise.resolve(mockChatHistory);

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  async createNewChat(): Promise<{ chatId: string }> {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.post<{ chatId: string }>('/api/chat/new');
      // return response;

      return Promise.resolve({ chatId: `chat-${Date.now()}` });

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  async deleteChat(): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // await apiClient.delete('/api/chat/current');

      return Promise.resolve();

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  async updateChatTitle(): Promise<void> {
    try {
      // TODO: Replace with actual API call
      // await apiClient.put('/api/chat/current/title', { title });

      return Promise.resolve();

    } catch (error) {
      throw this.handleChatError(error);
    }
  }

  private handleChatError(error: unknown): Error {
    if (error instanceof ApiError) {
      // Handle chat-specific error codes
      if (error.code) {
        switch (error.code) {
          case '2001': // CHAT_NOT_FOUND
            return new Error('Chat conversation not found.');
          case '2002': // MESSAGE_TOO_LONG
            return new Error('Message is too long. Please shorten your message and try again.');
          case '2003': // CONTEXT_LIMIT_EXCEEDED
            return new Error('Too many documents selected. Please reduce the number of context documents.');
          case '2004': // RATE_LIMIT_EXCEEDED
            return new Error('Too many messages sent. Please wait a moment before sending another message.');
          case '2005': // DOCUMENT_NOT_ACCESSIBLE
            return new Error('One or more selected documents are not accessible.');
          case '2006': // PROCESSING_ERROR
            return new Error('Error processing your message. Please try again.');
          case '2007': // CONTEXT_PROCESSING_FAILED
            return new Error('Failed to process document context. Please try selecting different documents.');
          default:
            return new Error(error.message || 'An error occurred while processing your request');
        }
      }

      // Fallback to HTTP status codes
      switch (error.status) {
        case 400:
          return new Error('Invalid request. Please check your message and try again.');
        case 403:
          return new Error('Access denied. You may not have permission to access these documents.');
        case 404:
          return new Error('Chat conversation not found.');
        case 413:
          return new Error('Message is too large. Please shorten your message and try again.');
        case 429:
          return new Error('Too many requests. Please wait a moment before trying again.');
        case 500:
          return new Error('Server error. Please try again later.');
        case 503:
          return new Error('Chat service is temporarily unavailable. Please try again later.');
        default:
          return new Error(error.message || 'Failed to process chat request');
      }
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('An unexpected error occurred while processing your chat request');
  }
}

export const chatService = new ChatService();
