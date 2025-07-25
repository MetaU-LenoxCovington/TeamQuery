import { apiClient } from './api';

export interface DocumentUploadRequest {
  title: string;
  accessLevel?: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  groupId?: string;
  file: File;
}

export interface DocumentUploadResponse {
  id: string;
  title: string;
  filename: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  accessLevel: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  uploadedAt: string;
  groupId?: string;
  groupName?: string;
}

export interface Document {
  id: string;
  title: string;
  filename: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  accessLevel: 'PUBLIC' | 'PRIVATE' | 'GROUP';
  uploadedAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
  groupId?: string;
  group?: {
    id: string;
    name: string;
  };
}

export interface DocumentListResponse {
  success: boolean;
  data: Document[];
}

export interface DocumentStatusResponse {
  success: boolean;
  data: {
    id: string;
    status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
    processingProgress?: number;
    error?: string;
  };
}

class DocumentService {
  async uploadDocument(organizationId: string, data: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('title', data.title);
    formData.append('organizationId', organizationId);

    if (data.accessLevel) {
      formData.append('accessLevel', data.accessLevel);
    }

    if (data.groupId) {
      formData.append('groupId', data.groupId);
    }

    // Use direct fetch for file upload to avoid JSON.stringify in apiClient
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  async getDocuments(organizationId: string): Promise<Document[]> {
    const response = await apiClient.get<DocumentListResponse>(
      `/api/documents?organizationId=${organizationId}`
    );
    return response.data;
  }

  async getDocumentStatus(documentId: string): Promise<DocumentStatusResponse['data']> {
    const response = await apiClient.get<DocumentStatusResponse>(
      `/api/documents/${documentId}/status`
    );
    return response.data;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(`/api/documents/${documentId}`);
  }

  async updateDocument(documentId: string, updates: Partial<Pick<Document, 'title' | 'accessLevel' | 'groupId'>>): Promise<Document> {
    const response = await apiClient.put<{ success: boolean; data: Document }>(`/api/documents/${documentId}`, updates);
    return response.data;
  }

  async waitForProcessing(documentId: string, onProgress?: (progress: number) => void): Promise<DocumentStatusResponse['data']> {
    const pollInterval = 2000;
    const maxAttempts = 60;
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          attempts++;
          const status = await this.getDocumentStatus(documentId);

          if (onProgress && status.processingProgress) {
            onProgress(status.processingProgress);
          }

          if (status.status === 'READY' || status.status === 'FAILED') {
            resolve(status);
            return;
          }

          if (attempts >= maxAttempts) {
            reject(new Error('Document processing timeout'));
            return;
          }

          setTimeout(poll, pollInterval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }
}

export const documentService = new DocumentService();
