'use client';

import { useQuery } from '@tanstack/react-query';
import { messagesApi, clientsApi } from '@/lib/api';
import { 
  Users, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { data: queueStatus } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: () => messagesApi.getQueueStatus(),
    refetchInterval: 5000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { limit: 1 }],
    queryFn: () => clientsApi.getAll({ limit: 1 }),
  });

  const { data: messagesData } = useQuery({
    queryKey: ['messages', { limit: 1 }],
    queryFn: () => messagesApi.getAll({ limit: 1 }),
  });

  const stats = [
    {
      name: 'Total Clients',
      value: clientsData?.data?.pagination?.total || 0,
      icon: Users,
      color: 'bg-blue-500',
      href: '/clients',
    },
    {
      name: 'Messages Sent',
      value: queueStatus?.data?.queue?.completed || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      href: '/messages',
    },
    {
      name: 'Pending',
      value: queueStatus?.data?.queue?.pending || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      href: '/messages?status=PENDING',
    },
    {
      name: 'Failed',
      value: queueStatus?.data?.queue?.failed || 0,
      icon: AlertCircle,
      color: 'bg-red-500',
      href: '/messages?status=FAILED',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to your Client Management System</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/clients"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Users size={20} className="mr-2" />
            View Clients
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              href={stat.href}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Queue Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Queue Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">
              {queueStatus?.data?.queue?.pending || 0}
            </p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {queueStatus?.data?.queue?.processing || 0}
            </p>
            <p className="text-sm text-gray-600">Processing</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {queueStatus?.data?.queue?.completed || 0}
            </p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {queueStatus?.data?.queue?.failed || 0}
            </p>
            <p className="text-sm text-gray-600">Failed</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">
              {queueStatus?.data?.queue?.deadLetter || 0}
            </p>
            <p className="text-sm text-gray-600">Dead Letter</p>
          </div>
        </div>
      </div>

      {/* Rate Limit Status */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rate Limit Status</h2>
        <div className="flex items-center space-x-4">
          <TrendingUp className="h-8 w-8 text-primary-600" />
          <div>
            <p className="text-sm text-gray-600">
              Current capacity: {queueStatus?.data?.rateLimit?.currentReservoir || 0} / {queueStatus?.data?.rateLimit?.maxReservoir || 0} messages per minute
            </p>
            <p className="text-sm text-gray-600">
              Queued: {queueStatus?.data?.rateLimit?.queued || 0} | Running: {queueStatus?.data?.rateLimit?.running || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/clients"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Users className="h-6 w-6 text-primary-600 mr-3" />
            <span className="font-medium">Browse Clients</span>
          </Link>
          <Link
            href="/messages"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MessageSquare className="h-6 w-6 text-primary-600 mr-3" />
            <span className="font-medium">View Messages</span>
          </Link>
          <Link
            href="/import"
            className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <TrendingUp className="h-6 w-6 text-primary-600 mr-3" />
            <span className="font-medium">Import Data</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
