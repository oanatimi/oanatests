// Database type definitions

export enum MessageStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum QueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

export interface Client {
  id: string;
  companyName: string;
  status: string | null;
  category: string | null;
  cui: string | null;
  registrationNumber: string | null;
  caenCode: string | null;
  caenSection: string | null;
  caenDivision: string | null;
  caenGroup: string | null;
  county: string | null;
  locality: string | null;
  address: string | null;
  postalCode: string | null;
  revenue: number | null;
  netProfit: number | null;
  vatPayer: boolean | null;
  revenue2023: number | null;
  revenue2022: number | null;
  profit2023: number | null;
  profit2022: number | null;
  receivables2023: number | null;
  equity2023: number | null;
  employees: number | null;
  foundingYear: number | null;
  phoneVerified: string | null;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  phoneContact: string | null;
  phoneMarketing: string | null;
  phoneWebsite: string | null;
  emailPrimary: string | null;
  emailSecondary: string | null;
  emailMarketing: string | null;
  emailWebsite: string | null;
  emailContact: string | null;
  websites: string | null;
  administrator: string | null;
  contactPerson: string | null;
  contactDate: Date | null;
  dealId: string | null;
  observations: string | null;
  sourceFile: string | null;
  sourceSheet: string | null;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  clientId: string;
  phoneNumber: string;
  content: string;
  status: MessageStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageQueue {
  id: string;
  messageId: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  nextRetry: Date;
  lastError: string | null;
  status: QueueStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptOut {
  id: string;
  phoneNumber: string;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Extended types for queries with relations
export interface ClientWithMessageCount extends Client {
  _count?: { messages: number };
  messageCount?: number;
}

export interface ClientWithMessages extends Client {
  messages?: Message[];
}

export interface MessageWithClient extends Message {
  client?: {
    id: string;
    companyName: string;
    phonePrimary: string | null;
  };
}
