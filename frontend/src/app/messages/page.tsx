'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagesApi, Message } from '@/lib/api';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  QUEUED: 'bg-yellow-100 text-yellow-800',
  SENDING: 'bg-blue-100 text-blue-800',
  SENT: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const statusIcons: Record<string, React.ElementType> = {
  PENDING: Clock,
  QUEUED: Clock,
  SENDING: RefreshCw,
  SENT: CheckCircle,
  DELIVERED: CheckCircle,
  FAILED: AlertCircle,
};

export default function MessagesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['messages', { page, status }],
    queryFn: () => messagesApi.getAll({ page, limit: 20, status: status || undefined }),
    refetchInterval: 5000,
  });

  const { data: queueStatus } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => messagesApi.getQueueStatus(),
    refetchInterval: 5000,
  });

  const messages = messagesData?.data?.data || [];
  const pagination = messagesData?.data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Messages</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} total messages
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={20} className="mr-2" />
          Refresh
        </button>
      </div>

      {/* Queue Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <button
          onClick={() => { setStatus(''); setPage(1); }}
          className={`p-4 rounded-lg border-2 transition-colors ${
            status === '' ? 'border-primary-500 bg-primary-50' : 'border-transparent bg-white'
          }`}
        >
          <p className="text-2xl font-bold text-gray-900">
            {(queueStatus?.data?.queue?.pending || 0) +
              (queueStatus?.data?.queue?.processing || 0) +
              (queueStatus?.data?.queue?.completed || 0) +
              (queueStatus?.data?.queue?.failed || 0)}
          </p>
          <p className="text-sm text-gray-600">All</p>
        </button>
        <button
          onClick={() => { setStatus('QUEUED'); setPage(1); }}
          className={`p-4 rounded-lg border-2 transition-colors ${
            status === 'QUEUED' ? 'border-yellow-500 bg-yellow-50' : 'border-transparent bg-white'
          }`}
        >
          <p className="text-2xl font-bold text-yellow-600">
            {queueStatus?.data?.queue?.pending || 0}
          </p>
          <p className="text-sm text-gray-600">Pending</p>
        </button>
        <button
          onClick={() => { setStatus('SENDING'); setPage(1); }}
          className={`p-4 rounded-lg border-2 transition-colors ${
            status === 'SENDING' ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-white'
          }`}
        >
          <p className="text-2xl font-bold text-blue-600">
            {queueStatus?.data?.queue?.processing || 0}
          </p>
          <p className="text-sm text-gray-600">Sending</p>
        </button>
        <button
          onClick={() => { setStatus('SENT'); setPage(1); }}
          className={`p-4 rounded-lg border-2 transition-colors ${
            status === 'SENT' ? 'border-green-500 bg-green-50' : 'border-transparent bg-white'
          }`}
        >
          <p className="text-2xl font-bold text-green-600">
            {queueStatus?.data?.queue?.completed || 0}
          </p>
          <p className="text-sm text-gray-600">Sent</p>
        </button>
        <button
          onClick={() => { setStatus('FAILED'); setPage(1); }}
          className={`p-4 rounded-lg border-2 transition-colors ${
            status === 'FAILED' ? 'border-red-500 bg-red-50' : 'border-transparent bg-white'
          }`}
        >
          <p className="text-2xl font-bold text-red-600">
            {queueStatus?.data?.queue?.failed || 0}
          </p>
          <p className="text-sm text-gray-600">Failed</p>
        </button>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No messages found</div>
        ) : (
          <div className="divide-y">
            {messages.map((message: Message) => {
              const StatusIcon = statusIcons[message.status] || Clock;
              return (
                <div key={message.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/clients/${message.clientId}`}
                          className="font-medium text-gray-900 hover:text-primary-600"
                        >
                          {message.client?.companyName || 'Unknown Client'}
                        </Link>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[message.status]}`}>
                          <StatusIcon size={12} className="mr-1" />
                          {message.status}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-600 line-clamp-2">{message.content}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span>To: {message.phoneNumber}</span>
                        <span>
                          {format(new Date(message.createdAt), 'MMM d, yyyy HH:mm')}
                        </span>
                        {message.sentAt && (
                          <span>
                            Sent: {format(new Date(message.sentAt), 'HH:mm')}
                          </span>
                        )}
                        {message.retryCount > 0 && (
                          <span className="text-orange-600">
                            Retries: {message.retryCount}
                          </span>
                        )}
                      </div>
                      {message.errorMessage && (
                        <p className="mt-2 text-sm text-red-600">
                          Error: {message.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
