import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Client types
export interface Client {
  id: string;
  companyName: string;
  status?: string;
  cui?: string;
  registrationNumber?: string;
  caenCode?: string;
  caenSection?: string;
  caenDivision?: string;
  caenGroup?: string;
  county?: string;
  locality?: string;
  address?: string;
  postalCode?: string;
  revenue?: number;
  netProfit?: number;
  vatPayer?: boolean;
  revenue2023?: number;
  revenue2022?: number;
  profit2023?: number;
  profit2022?: number;
  receivables2023?: number;
  equity2023?: number;
  phonePrimary?: string;
  phoneSecondary?: string;
  phoneContact?: string;
  phoneMarketing?: string;
  phoneWebsite?: string;
  phoneVerified?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  emailMarketing?: string;
  emailWebsite?: string;
  emailContact?: string;
  websites?: string;
  administrator?: string;
  employees?: number;
  foundingYear?: number;
  observations?: string;
  sourceFile?: string;
  sourceSheet?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
  messages?: Message[];
}

export interface Message {
  id: string;
  clientId: string;
  phoneNumber: string;
  content: string;
  status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  client?: {
    id: string;
    companyName: string;
    phonePrimary?: string;
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueueStatus {
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
  };
  rateLimit: {
    currentReservoir: number;
    maxReservoir: number;
    queued: number;
    running: number;
  };
}

// API functions
export const clientsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    county?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => api.get<PaginatedResponse<Client>>('/clients', { params }),
  
  getById: (id: string) => api.get<Client>(`/clients/${id}`),
  
  update: (id: string, data: Partial<Client>) => api.put<Client>(`/clients/${id}`, data),
  
  delete: (id: string) => api.delete(`/clients/${id}`),
  
  getCounties: () => api.get<string[]>('/clients/counties'),
};

export const messagesApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    clientId?: string;
  }) => api.get<PaginatedResponse<Message>>('/messages', { params }),
  
  send: (clientId: string, content: string, phoneNumber?: string) =>
    api.post('/messages/send', { clientId, content, phoneNumber }),
  
  sendBulk: (clientIds: string[], content: string) =>
    api.post('/messages/bulk', { clientIds, content }),
  
  getQueueStatus: () => api.get<QueueStatus>('/messages/queue/status'),
  
  retryDeadLetters: () => api.post('/messages/queue/retry-dead-letters'),
  
  getTemplates: () => api.get<MessageTemplate[]>('/messages/templates'),
  
  createTemplate: (name: string, content: string) =>
    api.post<MessageTemplate>('/messages/templates', { name, content }),
  
  updateTemplate: (id: string, name: string, content: string) =>
    api.put<MessageTemplate>(`/messages/templates/${id}`, { name, content }),
  
  deleteTemplate: (id: string) => api.delete(`/messages/templates/${id}`),
};

export const importApi = {
  importClients: (directory?: string) =>
    api.post('/import/clients', { directory }),
};
