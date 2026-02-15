'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, messagesApi, Message } from '@/lib/api';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Building,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Globe,
  Calendar
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
  SENDING: Clock,
  SENT: CheckCircle,
  DELIVERED: CheckCircle,
  FAILED: AlertCircle,
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [messageContent, setMessageContent] = useState('');
  const [showSendForm, setShowSendForm] = useState(false);

  const clientId = params.id as string;

  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getById(clientId),
    enabled: !!clientId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({ clientId, content }: { clientId: string; content: string }) =>
      messagesApi.send(clientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] });
      setMessageContent('');
      setShowSendForm(false);
      alert('Message queued successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const client = clientData?.data;

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Client not found</div>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!messageContent.trim()) {
      alert('Please enter a message');
      return;
    }
    sendMessageMutation.mutate({
      clientId: client.id,
      content: messageContent,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.companyName}</h1>
          <p className="text-gray-600">{client.status || 'Active'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client.phonePrimary && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Primary Phone</p>
                    <p className="font-medium">{client.phonePrimary}</p>
                  </div>
                </div>
              )}
              {client.phoneSecondary && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Secondary Phone</p>
                    <p className="font-medium">{client.phoneSecondary}</p>
                  </div>
                </div>
              )}
              {client.emailPrimary && (
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Primary Email</p>
                    <p className="font-medium">{client.emailPrimary}</p>
                  </div>
                </div>
              )}
              {client.websites && (
                <div className="flex items-center space-x-3">
                  <Globe className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Website</p>
                    <a href={client.websites} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 hover:underline">
                      {client.websites}
                    </a>
                  </div>
                </div>
              )}
              {client.administrator && (
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Administrator</p>
                    <p className="font-medium">{client.administrator}</p>
                  </div>
                </div>
              )}
              {client.county && (
                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium">{client.locality ? `${client.locality}, ` : ''}{client.county}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Company Details */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {client.cui && (
                <div>
                  <p className="text-sm text-gray-500">CUI</p>
                  <p className="font-medium">{client.cui}</p>
                </div>
              )}
              {client.registrationNumber && (
                <div>
                  <p className="text-sm text-gray-500">Registration Number</p>
                  <p className="font-medium">{client.registrationNumber}</p>
                </div>
              )}
              {client.foundingYear && (
                <div>
                  <p className="text-sm text-gray-500">Founded</p>
                  <p className="font-medium">{client.foundingYear}</p>
                </div>
              )}
              {client.employees && (
                <div>
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="font-medium">{client.employees}</p>
                </div>
              )}
              {client.revenue && (
                <div>
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="font-medium">{client.revenue.toLocaleString()} RON</p>
                </div>
              )}
              {client.caenCode && (
                <div>
                  <p className="text-sm text-gray-500">CAEN Code</p>
                  <p className="font-medium">{client.caenCode}</p>
                </div>
              )}
            </div>
          </div>

          {/* Message History */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Message History</h2>
              <button
                onClick={() => setShowSendForm(!showSendForm)}
                className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Send size={16} className="mr-1" />
                Send Message
              </button>
            </div>

            {/* Send Message Form */}
            {showSendForm && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Enter your message..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-sm text-gray-500">
                    {messageContent.length} / 480 characters
                  </p>
                  <div className="space-x-2">
                    <button
                      onClick={() => setShowSendForm(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages List */}
            {client.messages && client.messages.length > 0 ? (
              <div className="space-y-4">
                {client.messages.map((message: Message) => {
                  const StatusIcon = statusIcons[message.status] || Clock;
                  return (
                    <div key={message.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-gray-900">{message.content}</p>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Calendar size={14} className="mr-1" />
                              {format(new Date(message.createdAt), 'MMM d, yyyy HH:mm')}
                            </span>
                            <span className="flex items-center">
                              <Phone size={14} className="mr-1" />
                              {message.phoneNumber}
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[message.status]}`}>
                          <StatusIcon size={12} className="mr-1" />
                          {message.status}
                        </span>
                      </div>
                      {message.errorMessage && (
                        <p className="mt-2 text-sm text-red-600">
                          Error: {message.errorMessage}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No messages sent yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowSendForm(true)}
                className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Send size={20} className="mr-2" />
                Send SMS
              </button>
              {client.phonePrimary && (
                <a
                  href={`tel:${client.phonePrimary}`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Phone size={20} className="mr-2" />
                  Call
                </a>
              )}
              {client.emailPrimary && (
                <a
                  href={`mailto:${client.emailPrimary}`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Mail size={20} className="mr-2" />
                  Email
                </a>
              )}
            </div>
          </div>

          {/* Source Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Info</h2>
            <div className="space-y-2 text-sm">
              {client.sourceFile && (
                <div>
                  <p className="text-gray-500">Source File</p>
                  <p className="font-medium">{client.sourceFile}</p>
                </div>
              )}
              {client.sourceSheet && (
                <div>
                  <p className="text-gray-500">Sheet</p>
                  <p className="font-medium">{client.sourceSheet}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Imported</p>
                <p className="font-medium">
                  {format(new Date(client.createdAt), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
