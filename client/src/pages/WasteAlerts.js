import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

const WasteAlerts = () => {
  const { user } = useContext(AuthContext);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [filters, setFilters] = useState({
    riskLevel: '',
    status: '',
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({
    totalPages: 0,
    currentPage: 1,
    total: 0
  });

  useEffect(() => {
    fetchAlerts();
  }, [filters]);

  const fetchAlerts = () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    api.get(`/alerts?${params.toString()}`, { 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
    })
      .then(res => {
        setAlerts(res.data.alerts || []);
        setPagination({
          totalPages: res.data.totalPages || 0,
          currentPage: res.data.currentPage || 1,
          total: res.data.total || 0
        });
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch alerts');
        setLoading(false);
      });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      await api.put(`/alerts/${id}/resolve`, {}, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      fetchAlerts();
      toast.success('Alert resolved!');
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
    setResolvingId(null);
  };

  const handleAcknowledge = async (id) => {
    setAcknowledgingId(id);
    try {
      await api.put(`/alerts/${id}/acknowledge`, {}, { 
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
      });
      fetchAlerts();
    } catch (err) {
      alert('Failed to acknowledge alert.');
    }
    setAcknowledgingId(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await api.delete(`/alerts/${id}`, { 
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
        });
        fetchAlerts();
        toast.success('Alert deleted!');
      } catch (error) {
        toast.error('Failed to delete alert');
      }
    }
  };

  const openAlertDetails = (alert) => {
    setSelectedAlert(alert);
    setShowModal(true);
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-red-600 bg-red-100';
      case 'acknowledged': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(Math.round(num * 100) / 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Waste Alerts</h2>
        <div className="text-sm text-gray-600">
          Total: {pagination.total} alerts
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
            <select
              value={filters.riskLevel}
              onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Items per page</label>
            <select
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ riskLevel: '', status: '', page: 1, limit: 10 })}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-lg">Loading alerts...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Predicted Waste</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map(alert => (
                  <tr key={alert._id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {alert.productId?.name || '-'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {alert.productId?.category || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {alert.supplierId?.name || '-'}
                      </div>
                      <div className="text-sm text-gray-500">
                        ESG: {alert.supplierId?.ESGscore || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(alert.riskLevel)}`}>
                        {alert.riskLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatNumber(alert.predictedWasteQty)} kg
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatNumber(alert.predictedWastePercentage)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {alert.predictedDate ? new Date(alert.predictedDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold 
                        ${alert.severity === 'High' ? 'bg-red-100 text-red-800' : alert.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openAlertDetails(alert)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        {(user?.role === 'manager' || (user?.role === 'supplier' && user?.supplierId === (alert.supplierId?._id || alert.supplierId))) && (
                          <>
                            {alert.status === 'active' && (
                              <button
                                onClick={() => handleAcknowledge(alert._id)}
                                disabled={acknowledgingId === alert._id}
                                className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                              >
                                {acknowledgingId === alert._id ? 'Acknowledging...' : 'Acknowledge'}
                              </button>
                            )}
                            {alert.status === 'acknowledged' && (
                              <button
                                onClick={() => handleResolve(alert._id)}
                                disabled={resolvingId === alert._id}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                {resolvingId === alert._id ? 'Resolving...' : 'Resolve'}
                              </button>
                            )}
                            {user?.role === 'manager' && (
                              <button
                                onClick={() => handleDelete(alert._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                    <span className="font-medium">{pagination.totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pagination.currentPage
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert Details Modal */}
      {showModal && selectedAlert && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Alert Details</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Product</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlert.productId?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Supplier</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlert.supplierId?.name || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Risk Level</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(selectedAlert.riskLevel)}`}>
                      {selectedAlert.riskLevel}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedAlert.status)}`}>
                      {selectedAlert.status}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Predicted Waste</label>
                    <p className="mt-1 text-sm text-gray-900">{formatNumber(selectedAlert.predictedWasteQty)} kg ({formatNumber(selectedAlert.predictedWastePercentage)}%)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Stock</label>
                    <p className="mt-1 text-sm text-gray-900">{formatNumber(selectedAlert.currentStock)} kg</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Predicted Date</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlert.predictedDate ? new Date(selectedAlert.predictedDate).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confidence</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlert.confidence}%</p>
                  </div>
                </div>
                
                {selectedAlert.factors && selectedAlert.factors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contributing Factors</label>
                    <ul className="mt-1 text-sm text-gray-900 list-disc list-inside">
                      {selectedAlert.factors.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedAlert.recommendations && selectedAlert.recommendations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Recommendations</label>
                    <ul className="mt-1 text-sm text-gray-900 list-disc list-inside">
                      {selectedAlert.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedAlert.resolutionNotes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resolution Notes</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedAlert.resolutionNotes}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteAlerts; 