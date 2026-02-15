'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/lib/api';
import { 
  Settings as SettingsIcon, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: queueStatus, isLoading } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => messagesApi.getQueueStatus(),
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: () => messagesApi.retryDeadLetters(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      alert(`${response.data.retriedCount} messages queued for retry`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">System configuration and queue management</p>
      </div>

      {/* Queue Management */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Queue Management</h2>
        
        {isLoading ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Queue Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {queueStatus?.data?.queue?.pending || 0}
                </p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {queueStatus?.data?.queue?.processing || 0}
                </p>
                <p className="text-sm text-gray-600">Processing</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {queueStatus?.data?.queue?.completed || 0}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {queueStatus?.data?.queue?.failed || 0}
                </p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {queueStatus?.data?.queue?.deadLetter || 0}
                </p>
                <p className="text-sm text-gray-600">Dead Letter</p>
              </div>
            </div>

            {/* Dead Letter Queue */}
            {(queueStatus?.data?.queue?.deadLetter || 0) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900">Dead Letter Messages</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      There are {queueStatus?.data?.queue?.deadLetter} messages that have exceeded the maximum retry attempts.
                    </p>
                    <button
                      onClick={() => retryMutation.mutate()}
                      disabled={retryMutation.isPending}
                      className="mt-3 inline-flex items-center px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <RefreshCw size={16} className="mr-1" />
                      {retryMutation.isPending ? 'Retrying...' : 'Retry All'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rate Limit Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rate Limit Status</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Current Capacity</p>
              <p className="text-sm text-gray-600">Messages available per minute</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600">
                {queueStatus?.data?.rateLimit?.currentReservoir || 0}
              </p>
              <p className="text-sm text-gray-500">
                of {queueStatus?.data?.rateLimit?.maxReservoir || 0}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Queue Status</p>
              <p className="text-sm text-gray-600">Messages waiting to be sent</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                {queueStatus?.data?.rateLimit?.queued || 0}
              </p>
              <p className="text-sm text-gray-500">queued</p>
            </div>
          </div>
        </div>
      </div>

      {/* SMS Best Practices Info */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">SMS Best Practices</h2>
        <div className="space-y-4">
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Rate Limiting</h3>
              <p className="text-sm text-blue-700 mt-1">
                Messages are rate-limited to prevent being flagged as spam. The current limits are configured via environment variables.
              </p>
            </div>
          </div>
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Sending Hours</h3>
              <p className="text-sm text-blue-700 mt-1">
                SMS messages are only sent during business hours to respect recipients. Configure the allowed hours via environment variables.
              </p>
            </div>
          </div>
          <div className="flex items-start p-4 bg-blue-50 rounded-lg">
            <Info className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">Recipient Limits</h3>
              <p className="text-sm text-blue-700 mt-1">
                Each recipient has daily and weekly message limits to prevent spam. A cooldown period is also enforced between messages.
              </p>
            </div>
          </div>
          <div className="flex items-start p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-900">Opt-Out Support</h3>
              <p className="text-sm text-green-700 mt-1">
                Recipients can opt out by replying with the configured keyword. Their numbers will be automatically excluded from future messages.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Variables Reference */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Reference</h2>
        <p className="text-gray-600 mb-4">
          The following environment variables can be configured for this application:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variable</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">TRACCAR_SMS_URL</td>
                <td className="px-4 py-3 text-sm text-gray-600">Traccar SMS Gateway URL</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">TRACCAR_API_TOKEN</td>
                <td className="px-4 py-3 text-sm text-gray-600">API Token for authentication</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">CLOUDFLARE_TUNNEL_URL</td>
                <td className="px-4 py-3 text-sm text-gray-600">Cloudflare tunnel URL (if using)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">SMS_RATE_LIMIT_PER_MINUTE</td>
                <td className="px-4 py-3 text-sm text-gray-600">Max messages per minute</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">SMS_ALLOWED_START_HOUR</td>
                <td className="px-4 py-3 text-sm text-gray-600">Start hour for sending (24h)</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">SMS_ALLOWED_END_HOUR</td>
                <td className="px-4 py-3 text-sm text-gray-600">End hour for sending (24h)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
