'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi, MessageTemplate } from '@/lib/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  FileText
} from 'lucide-react';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<{ name: string; content: string } | null>(null);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => messagesApi.getTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) =>
      messagesApi.createTemplate(name, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setNewTemplate(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, content }: { id: string; name: string; content: string }) =>
      messagesApi.updateTemplate(id, name, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setEditingTemplate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => messagesApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const templates = templatesData?.data || [];

  const handleCreate = () => {
    if (!newTemplate?.name || !newTemplate?.content) {
      alert('Please fill in all fields');
      return;
    }
    createMutation.mutate(newTemplate);
  };

  const handleUpdate = () => {
    if (!editingTemplate?.name || !editingTemplate?.content) {
      alert('Please fill in all fields');
      return;
    }
    updateMutation.mutate({
      id: editingTemplate.id,
      name: editingTemplate.name,
      content: editingTemplate.content,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Message Templates</h1>
          <p className="text-gray-600 mt-1">Create reusable message templates</p>
        </div>
        <button
          onClick={() => setNewTemplate({ name: '', content: '' })}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          New Template
        </button>
      </div>

      {/* New Template Form */}
      {newTemplate && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Template</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="e.g., Welcome Message"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message Content
              </label>
              <textarea
                value={newTemplate.content}
                onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                placeholder="Enter your message template..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                {newTemplate.content.length} / 480 characters
              </p>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setNewTemplate(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save size={20} className="mr-2" />
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No templates yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first template to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((template: MessageTemplate) => (
              <div key={template.id} className="p-4">
                {editingTemplate?.id === template.id ? (
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <textarea
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingTemplate(null)}
                        className="p-2 text-gray-600 hover:text-gray-900"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={handleUpdate}
                        disabled={updateMutation.isPending}
                        className="p-2 text-primary-600 hover:text-primary-700"
                      >
                        <Save size={20} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <p className="mt-1 text-gray-600">{template.content}</p>
                      <p className="mt-2 text-sm text-gray-500">
                        {template.content.length} characters
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setEditingTemplate(template)}
                        className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
