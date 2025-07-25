import { apiClient } from './api';
import { Message, Source } from '../types';

export interface RAGQueryRequest {
  query: string;
  organizationId: string;
  filters?: Record<string, any>;
  maxContextChunks?: number;
}

export interface RAGQueryResponse {
  query: string;
  answer: string;
  sources: Array<{
    chunk_id: string;
    document_id: string;
    document_title: string;
    content: string;
    page_number?: number;
    relevance_score: number;
  }>;
  conversation_id?: string;
  processing_time: number;
}

export interface SearchRequest {
  query: string;
  organizationId: string;
  k?: number;
  filters?: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  results: Array<{
    chunk_id: string;
    document_id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  total_results: number;
  processing_time: number;
}

class ChatService {
  async sendRAGQuery(data: RAGQueryRequest): Promise<RAGQueryResponse> {
    const response = await apiClient.post<{ success: boolean; data: RAGQueryResponse }>('/api/rag/query', data);
    return response.data;
  }

  async searchDocuments(data: SearchRequest): Promise<SearchResponse> {
    const response = await apiClient.post<{ success: boolean; data: SearchResponse }>('/api/rag/search', data);
    return response.data;
  }

  // Legacy method for backward compatibility with existing useChat hook
  async getMessages(): Promise<Message[]> {
    // TODO: Implement chat history persistence on backend
    // For now, return empty array since we're handling history on frontend
    return [];
  }

  // Updated method to connect to RAG system
  async sendMessage(data: { content: string; organizationId: string }): Promise<Message> {
    try {
      const ragResponse = await this.sendRAGQuery({
        query: data.content,
        organizationId: data.organizationId,
        maxContextChunks: 5
      });

      // Transform RAG response to Message format
      const sources: Source[] = ragResponse.sources.map(source => ({
        id: source.chunk_id,
        title: source.document_title,
        type: 'document',
        excerpt: source.content
      }));

      const message: Message = {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        sources: sources.length > 0 ? sources : undefined
      };

      return message;
    } catch (error) {
      console.error('RAG query failed:', error);

      // Return error message
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };

      return errorMessage;
    }
  }

  // TODO: Maybe will implement chat history later
  // For now, these are placeholder methods
  async getChatSessions(organizationId: string): Promise<any[]> {
    console.warn('Chat sessions not implemented yet - handling history on frontend');
    return [];
  }

  async createChatSession(organizationId: string, title?: string): Promise<any> {
    console.warn('Chat sessions not implemented yet - handling history on frontend');
    return { id: 'temp', title: title || 'New Chat' };
  }

  async getChatMessages(sessionId: string): Promise<any[]> {
    console.warn('Chat sessions not implemented yet - handling history on frontend');
    return [];
  }

  async updateChatSession(sessionId: string, updates: { title?: string }): Promise<any> {
    console.warn('Chat sessions not implemented yet - handling history on frontend');
    return { id: sessionId, ...updates };
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    console.warn('Chat sessions not implemented yet - handling history on frontend');
  }
}

export const chatService = new ChatService();
