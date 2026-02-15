'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi, messagesApi, Client, MessageTemplate } from '@/lib/api';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight,
  Phone,
  Mail,
  Building,
  MapPin,
  CheckSquare,
  Square,
  Send,
  Tag,
  FileText
} from 'lucide-react';
import Link from 'next/link';

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [county, setCounty] = useState('');
  const [category, setCategory] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showBulkMessage, setShowBulkMessage] = useState(false);
  const [bulkMessageContent, setBulkMessageContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients', { page, search, county, category }],
    queryFn: () => clientsApi.getAll({ page, limit: 20, search, county, category }),
  });

  const { data: counties } = useQuery({
    queryKey: ['counties'],
    queryFn: () => clientsApi.getCounties(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => clientsApi.getCategories(),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => messagesApi.getTemplates(),
  });

  const templates = templatesData?.data || [];

  const bulkMessageMutation = useMutation({
    mutationFn: ({ clientIds, content }: { clientIds: string[]; content: string }) =>
      messagesApi.sendBulk(clientIds, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setSelectedClients([]);
      setShowBulkMessage(false);
      setBulkMessageContent('');
      setSelectedTemplate('');
      alert('Messages queued successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t: MessageTemplate) => t.id === templateId);
    if (template) {
      setBulkMessageContent(template.content);
    }
  };

  const clients = clientsData?.data?.data || [];
  const pagination = clientsData?.data?.pagination;

  const toggleSelectClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(c => c.id));
    }
  };

  const handleBulkSend = () => {
    if (selectedClients.length === 0) {
      alert('Please select at least one client');
      return;
    }
    if (!bulkMessageContent.trim()) {
      alert('Please enter a message');
      return;
    }
    bulkMessageMutation.mutate({
      clientIds: selectedClients,
      content: bulkMessageContent,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Clients</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} total clients
          </p>
        </div>
        {selectedClients.length > 0 && (
          <button
            onClick={() => setShowBulkMessage(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Send size={20} className="mr-2" />
            Send to {selectedClients.length} selected
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, CUI, CAEN, phone, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {(categories?.data?.data || categories?.data || []).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="sm:w-48">
            <select
              value={county}
              onChange={(e) => {
                setCounty(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Counties</option>
              {(counties?.data?.data || counties?.data || []).map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Message Modal */}
      {showBulkMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Send Bulk Message
              </h2>
              <p className="text-gray-600 mb-4">
                Sending to {selectedClients.length} clients
              </p>
              
              {/* Template Selection */}
              {templates.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-1" />
                    Use Template (optional)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Write custom message...</option>
                    {templates.map((t: MessageTemplate) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Content
              </label>
              <textarea
                value={bulkMessageContent}
                onChange={(e) => setBulkMessageContent(e.target.value)}
                placeholder="Enter your message or select a template above..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                {bulkMessageContent.length} / 480 characters
                {selectedTemplate && <span className="ml-2 text-primary-600">(Editable)</span>}
              </p>
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => {
                    setShowBulkMessage(false);
                    setSelectedTemplate('');
                    setBulkMessageContent('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSend}
                  disabled={bulkMessageMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {bulkMessageMutation.isPending ? 'Sending...' : 'Send Messages'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clients List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Select All Header */}
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center">
          <button onClick={toggleSelectAll} className="mr-3">
            {selectedClients.length === clients.length && clients.length > 0 ? (
              <CheckSquare className="h-5 w-5 text-primary-600" />
            ) : (
              <Square className="h-5 w-5 text-gray-400" />
            )}
          </button>
          <span className="text-sm text-gray-600">
            {selectedClients.length > 0
              ? `${selectedClients.length} selected`
              : 'Select all'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No clients found</div>
        ) : (
          <div className="divide-y">
            {clients.map((client: Client) => (
              <div
                key={client.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start">
                  <button
                    onClick={() => toggleSelectClient(client.id)}
                    className="mr-3 mt-1"
                  >
                    {selectedClients.includes(client.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary-600" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-lg font-medium text-gray-900 hover:text-primary-600"
                      >
                        {client.companyName}
                      </Link>
                      {client.category && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {client.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                      {client.cui && (
                        <div className="flex items-center">
                          <Building size={14} className="mr-1 text-gray-400" />
                          CUI: {client.cui}
                        </div>
                      )}
                      {client.caenCode && (
                        <div className="flex items-center">
                          <Tag size={14} className="mr-1 text-gray-400" />
                          CAEN: {client.caenCode}
                        </div>
                      )}
                      {client.phonePrimary && (
                        <div className="flex items-center">
                          <Phone size={14} className="mr-1 text-gray-400" />
                          {client.phonePrimary}
                        </div>
                      )}
                      {client.emailPrimary && (
                        <div className="flex items-center truncate">
                          <Mail size={14} className="mr-1 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{client.emailPrimary}</span>
                        </div>
                      )}
                      {client.county && (
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-1 text-gray-400" />
                          {client.county}
                        </div>
                      )}
                      {client._count?.messages !== undefined && (
                        <div className="flex items-center">
                          <MessageSquare size={14} className="mr-1 text-gray-400" />
                          {client._count.messages} messages
                        </div>
                      )}
                    </div>
                    {client.observations && (
                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                        {client.observations}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/clients/${client.id}`}
                    className="ml-4 px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
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
