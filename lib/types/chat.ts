export type MessageRole = 'user' | 'assistant' | 'system';

export interface Source {
  id: number;
  title: string;
  domain: string;
  url: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  sizeBytes: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  sources?: Source[];
  attachments?: Attachment[];
  isStreaming?: boolean;
}

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
  supportsVision: boolean;
  supportsTools: boolean;
}
