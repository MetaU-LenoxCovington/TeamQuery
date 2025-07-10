export interface User {
  id: string;
  name: string;
  email: string;
  organizations: Organization[];
}

export interface Organization {
  id: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  isAdmin: boolean;
}

export interface Group {
  id: string;
  name: string;
  documentCount: number;
  folders: Folder[];
}

export interface Folder {
  id: string;
  name: string;
  documents: string[];
}

export interface Document {
  id: string;
  title: string;
  type: 'document' | 'folder';
  groupId: string;
  accessLevel: string;
  size?: string;
  children?: Document[];
}

export interface Source {
  id: string;
  title: string;
  type: 'document' | 'folder';
  excerpt?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

export interface ChatHistory {
  id: string;
  title: string;
  timestamp: string;
  preview: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

export type UserRole = Organization['role'];
