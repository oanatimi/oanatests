'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi, Vehicle } from '@/lib/api';
import { 
  Search, 
  Car,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone
} from 'lucide-react';

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [itpStatusFilter, setItpStatusFilter] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    licensePlate: '',
    brand: '',
    model: '',
    itpExpiryDate: '',
  });
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['vehicles', { page, search, itpStatus: itpStatusFilter }],
    queryFn: () => vehiclesApi.getAll({ page, limit: 20, search, itpStatus: itpStatusFilter }),
  });

  const createVehicleMutation = useMutation({
    mutationFn: (data: Partial<Vehicle>) => vehiclesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowAddVehicle(false);
      setNewVehicle({ licensePlate: '', brand: '', model: '', itpExpiryDate: '' });
      alert('Vehicle added successfully!');
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: (vehicleId: string) => vehiclesApi.sendReminder(vehicleId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      const data = response.data?.data;
      if (data) {
        alert(`Reminder sent for ${data.vehicleLicensePlate}!\n\nMessage: ${data.messageContent}`);
      } else {
        alert('Reminder sent successfully!');
      }
      setSendingReminderId(null);
    },
    onError: (error: Error) => {
      alert(`Error sending reminder: ${error.message}`);
      setSendingReminderId(null);
    },
  });

  const vehicles = vehiclesData?.data?.data || [];
  const pagination = vehiclesData?.data?.pagination;

  const handleAddVehicle = () => {
    if (!newVehicle.licensePlate.trim()) {
      alert('License plate is required');
      return;
    }
    createVehicleMutation.mutate(newVehicle);
  };

  const handleSendReminder = (vehicleId: string) => {
    setSendingReminderId(vehicleId);
    sendReminderMutation.mutate(vehicleId);
  };

  const getItpStatusBadge = (vehicle: Vehicle) => {
    if (!vehicle.itpExpiryDate) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <Clock size={12} className="mr-1" />
          Necunoscut
        </span>
      );
    }

    switch (vehicle.itpStatus) {
      case 'expired':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertTriangle size={12} className="mr-1" />
            Expirat
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock size={12} className="mr-1" />
            Expiră în {vehicle.daysUntilItpExpiry} zile
          </span>
        );
      case 'valid':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle size={12} className="mr-1" />
            Valid
          </span>
        );
      default:
        return null;
    }
  };

  const getReminderStatus = (vehicle: Vehicle) => {
    if (!vehicle.itpExpiryDate) return null;

    // Only show reminder status for vehicles with expiring/expired ITP
    if (vehicle.itpStatus !== 'expired' && vehicle.itpStatus !== 'expiring_soon') {
      return null;
    }

    if (vehicle.hasItpReminder) {
      const sentDate = vehicle.lastItpReminderSentAt 
        ? new Date(vehicle.lastItpReminderSentAt).toLocaleDateString('ro-RO')
        : '';
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Bell size={12} className="mr-1" />
          Reminder trimis {sentDate}
        </span>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <BellOff size={12} className="mr-1" />
            Fără reminder
          </span>
          <span className="text-xs text-gray-500">
            ITP expiră: {new Date(vehicle.itpExpiryDate).toLocaleDateString('ro-RO')}
          </span>
        </div>
      );
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ro-RO');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Vehicule</h1>
          <p className="text-gray-600 mt-1">
            {pagination?.total || 0} vehicule înregistrate
          </p>
        </div>
        <button
          onClick={() => setShowAddVehicle(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Adaugă vehicul
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Caută după nr. înmatriculare, marcă, model..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={itpStatusFilter}
              onChange={(e) => {
                setItpStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Toate vehiculele</option>
              <option value="without_reminder">Fără reminder (ITP expiră curând)</option>
              <option value="expired">ITP expirat</option>
              <option value="expiring_soon">ITP expiră în 30 zile</option>
              <option value="valid">ITP valid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Adaugă vehicul nou
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Număr înmatriculare *
                  </label>
                  <input
                    type="text"
                    value={newVehicle.licensePlate}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                    placeholder="ex: B 123 ABC"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marcă
                    </label>
                    <input
                      type="text"
                      value={newVehicle.brand}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, brand: e.target.value }))}
                      placeholder="ex: Dacia"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="ex: Logan"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data expirare ITP
                  </label>
                  <input
                    type="date"
                    value={newVehicle.itpExpiryDate}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, itpExpiryDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => {
                    setShowAddVehicle(false);
                    setNewVehicle({ licensePlate: '', brand: '', model: '', itpExpiryDate: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Anulează
                </button>
                <button
                  onClick={handleAddVehicle}
                  disabled={createVehicleMutation.isPending}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {createVehicleMutation.isPending ? 'Se salvează...' : 'Salvează'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Se încarcă...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {itpStatusFilter === 'without_reminder' 
              ? 'Nu există vehicule fără reminder cu ITP care expiră curând'
              : 'Nu au fost găsite vehicule'}
          </div>
        ) : (
          <div className="divide-y">
            {vehicles.map((vehicle: Vehicle) => (
              <div
                key={vehicle.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <Car size={20} className="text-gray-400" />
                      <span className="text-lg font-semibold text-gray-900">
                        {vehicle.licensePlate}
                      </span>
                      {vehicle.brand && (
                        <span className="text-gray-600">
                          {vehicle.brand} {vehicle.model}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {getItpStatusBadge(vehicle)}
                      {getReminderStatus(vehicle)}
                    </div>

                    <div className="mt-2 text-sm text-gray-500 flex items-center gap-4">
                      <span className="flex items-center">
                        <Calendar size={14} className="mr-1" />
                        ITP: {formatDate(vehicle.itpExpiryDate)}
                      </span>
                      {vehicle.clientName && (
                        <span className="flex items-center">
                          Client: {vehicle.clientName}
                        </span>
                      )}
                      {vehicle.clientPhone && (
                        <span className="flex items-center">
                          <Phone size={14} className="mr-1" />
                          {vehicle.clientPhone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="ml-4 flex items-center gap-2">
                    {/* Show send reminder button for vehicles without reminder that have expiring/expired ITP */}
                    {vehicle.itpExpiryDate && 
                     (vehicle.itpStatus === 'expired' || vehicle.itpStatus === 'expiring_soon') &&
                     !vehicle.hasItpReminder && (
                      <button
                        onClick={() => handleSendReminder(vehicle.id)}
                        disabled={sendingReminderId === vehicle.id}
                        className="inline-flex items-center px-3 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                        title="Trimite reminder ITP"
                      >
                        <Send size={16} className="mr-1" />
                        {sendingReminderId === vehicle.id ? 'Se trimite...' : 'Trimite reminder'}
                      </button>
                    )}
                  </div>
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
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Pagina {page} din {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Următor
              <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
