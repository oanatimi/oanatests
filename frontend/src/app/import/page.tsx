'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { importApi } from '@/lib/api';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle,
  Loader,
  Terminal
} from 'lucide-react';

export default function ImportPage() {
  const [importResult, setImportResult] = useState<{
    success: boolean;
    filesProcessed: number;
    imported: number;
    skipped: number;
    errors: string[];
    logs: string[];
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: () => importApi.importClients(),
    onSuccess: (response) => {
      setImportResult(response.data);
    },
    onError: (error: Error) => {
      alert(`Import failed: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 hidden md:block">Import Data</h1>
        <p className="text-gray-600 mt-1">Import clients from Excel files</p>
      </div>

      {/* Import Card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center">
          <FileSpreadsheet className="h-16 w-16 text-primary-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Import Clients from Excel
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This will import client data from Excel files (.xlsx) located in the configured data directory.
            Duplicate clients will be automatically skipped.
          </p>
          
          <button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {importMutation.isPending ? (
              <>
                <Loader className="h-5 w-5 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mr-2" />
                Start Import
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`rounded-xl shadow-sm p-6 ${
          importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start">
            {importResult.success ? (
              <CheckCircle className="h-6 w-6 text-green-600 mr-3 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${importResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {importResult.success ? 'Import Completed' : 'Import Completed with Errors'}
              </h3>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{importResult.filesProcessed}</p>
                  <p className="text-sm text-gray-600">Files Processed</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-sm text-gray-600">Clients Imported</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                  <p className="text-sm text-gray-600">Duplicates Skipped</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-900 mb-2">Errors ({importResult.errors.length})</h4>
                  <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                    <ul className="space-y-1 text-sm text-red-700">
                      {importResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {importResult.logs && importResult.logs.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Terminal className="h-4 w-4 mr-2" />
                    Import Logs ({importResult.logs.length})
                  </h4>
                  <div className="bg-gray-900 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs">
                    {importResult.logs.map((log, index) => (
                      <div key={index} className="text-green-400 whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Supported File Formats</h2>
        <div className="space-y-4 text-gray-600">
          <p>
            The import process supports Excel files (.xlsx) with the following columns:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Required Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Numele Companiei (Company Name)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Contact Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Telefon Principal (Primary Phone)</li>
                <li>Telefon Secundar (Secondary Phone)</li>
                <li>Email Principal (Primary Email)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Location Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Judet (County)</li>
                <li>Localitate (Locality)</li>
                <li>Adresa (Address)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Business Fields</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>CUI (Tax ID)</li>
                <li>Cod CAEN (CAEN Code)</li>
                <li>Administrator</li>
                <li>Angajati (Employees)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
