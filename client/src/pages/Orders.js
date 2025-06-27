import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { ArrowTrendingUpIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Orders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEcoOptions, setShowEcoOptions] = useState(false);
  const [ecoOptions, setEcoOptions] = useState({
    minimalPackaging: false,
    greenDelivery: false,
    carbonOffset: false,
    localSourcing: false,
    bulkOrdering: false
  });
  const [orderItems, setOrderItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [customerEmail, setCustomerEmail] = useState('');
  const [ecoImpact, setEcoImpact] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [submittedEcoImpact, setSubmittedEcoImpact] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchEcoAnalytics();
  }, [period]);

  const fetchOrders = () => {
    setLoading(true);
    api.get('/orders', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => {
        setOrders(res.data.orders || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch orders');
        setLoading(false);
      });
  };

  const fetchEcoAnalytics = () => {
    api.get(`/orders/analytics/eco-adoption?period=${period}`, { 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
    })
      .then(res => {
        setAnalytics(res.data.analytics);
      })
      .catch(() => {
        console.error('Failed to fetch eco analytics');
      });
  };

  const calculateEcoImpact = async () => {
    try {
      const params = new URLSearchParams({
        minimalPackaging: ecoOptions.minimalPackaging,
        greenDelivery: ecoOptions.greenDelivery,
        carbonOffset: ecoOptions.carbonOffset,
        localSourcing: ecoOptions.localSourcing,
        bulkOrdering: ecoOptions.bulkOrdering,
        totalAmount: totalAmount.toString(),
        items: JSON.stringify(orderItems)
      });

      const response = await api.get(`/orders/eco-impact?${params}`);
      setEcoImpact(response.data.ecoImpact);
    } catch (error) {
      console.error('Failed to calculate eco impact:', error);
    }
  };

  const handleEcoOptionChange = (option) => {
    setEcoOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleSubmitEcoOptions = async () => {
    try {
      const res = await api.post('/orders/eco-options', {
        customerEmail,
        preferences: ecoOptions,
        items: orderItems,
        totalAmount
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

      setShowEcoOptions(false);
      setSubmittedEcoImpact(res.data.order.ecoImpact);
      setEcoOptions({
        minimalPackaging: false,
        greenDelivery: false,
        carbonOffset: false,
        localSourcing: false,
        bulkOrdering: false
      });
      setOrderItems([]);
      setTotalAmount(0);
      setCustomerEmail('');
      setEcoImpact(null);
      fetchOrders();
      fetchEcoAnalytics();
      toast.success('Eco options submitted!');
    } catch (error) {
      toast.error('Failed to submit eco options');
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(Math.round(num * 100) / 100);
  };

  const formatPercentage = (num) => {
    return `${Math.round(num * 100) / 100}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Orders & Eco Options</h2>
        <div className="flex space-x-4">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          {user?.role === 'consumer' && (
            <button
              onClick={() => setShowEcoOptions(true)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Record Eco Options
            </button>
          )}
        </div>
      </div>

      {/* Eco Analytics */}
      {user?.role === 'consumer' && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="card flex items-center">
            <ArrowTrendingUpIcon className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <div className="text-gray-600 text-sm">Total Carbon Saved</div>
              <div className="text-2xl font-bold">{formatNumber(analytics.summary.totalImpact)}</div>
            </div>
          </div>
          <div className="card flex items-center">
            <TrashIcon className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <div className="text-gray-600 text-sm">Total Waste Reduced</div>
              <div className="text-2xl font-bold">{formatNumber(analytics.summary.totalImpact)}</div>
            </div>
          </div>
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalOrders)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Impact</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalImpact)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Eco Options</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.avgEcoOptionsPerOrder)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Adoption Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.adoptionRates && analytics.adoptionRates.greenDelivery 
                    ? formatPercentage(analytics.adoptionRates.greenDelivery.percentage) 
                    : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Eco Options Adoption Chart */}
      {analytics && analytics.adoptionRates && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Eco Options Adoption</h3>
          <div className="space-y-4">
            {Object.entries(analytics.adoptionRates).map(([option, data]) => (
              <div key={option} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="font-medium capitalize">{option.replace(/([A-Z])/g, ' $1').trim()}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPercentage(data.percentage)}</div>
                  <div className="text-sm text-gray-500">{data.adopted} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Orders</h3>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-lg">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 text-lg">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eco Impact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map(order => (
                  <tr key={order._id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderId || order._id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.customerEmail || order.customerName || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${formatNumber(order.totalAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.ecoImpact ? (
                        <div className="text-sm">
                          <div className="text-green-600">+{formatNumber(order.ecoImpact.carbonSaved)} kg CO2 saved</div>
                          <div className="text-blue-600">+{formatNumber(order.ecoImpact.wasteReduced)} kg waste reduced</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">No eco options</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.timestamp || order.createdAt ? new Date(order.timestamp || order.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Eco Options Modal */}
      {user?.role === 'consumer' && showEcoOptions && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">Record Eco Options</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Customer Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    placeholder="customer@example.com"
                  />
                </div>

                {/* Order Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Order Amount ($)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Eco Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Eco Options</label>
                  <div className="space-y-3">
                    {Object.entries(ecoOptions).map(([option, checked]) => (
                      <label key={option} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleEcoOptionChange(option)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="ml-3 text-sm text-gray-700 capitalize">
                          {option.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Calculate Impact Button */}
                <button
                  onClick={calculateEcoImpact}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Calculate Eco Impact
                </button>

                {/* Eco Impact Display */}
                {ecoImpact && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Estimated Eco Impact</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 font-medium">Carbon Saved:</span>
                        <span className="ml-2">{formatNumber(ecoImpact.carbonSaved)} kg CO2</span>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Waste Reduced:</span>
                        <span className="ml-2">{formatNumber(ecoImpact.wasteReduced)} kg</span>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Cost Savings:</span>
                        <span className="ml-2">${formatNumber(ecoImpact.costSavings)}</span>
                      </div>
                      <div>
                        <span className="text-green-600 font-medium">Eco Score:</span>
                        <span className="ml-2">{formatNumber(ecoImpact.ecoScore)}/100</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowEcoOptions(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitEcoOptions}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Submit Eco Options
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submittedEcoImpact && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 text-green-700">Eco Impact Recorded!</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium text-green-600">Carbon Saved:</span> {formatNumber(submittedEcoImpact.carbonSaved)} kg CO2</div>
              <div><span className="font-medium text-blue-600">Waste Reduced:</span> {formatNumber(submittedEcoImpact.wasteReduced)} kg</div>
              <div><span className="font-medium text-green-600">Cost Savings:</span> ${formatNumber(submittedEcoImpact.costSavings)}</div>
              {submittedEcoImpact.ecoScore && (
                <div><span className="font-medium text-green-600">Eco Score:</span> {formatNumber(submittedEcoImpact.ecoScore)}/100</div>
              )}
            </div>
            <button
              onClick={() => setSubmittedEcoImpact(null)}
              className="mt-6 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders; 