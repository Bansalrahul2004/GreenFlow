import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Analytics = () => {
  const { user } = useContext(AuthContext);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('30d');
  const [sustainabilityScore, setSustainabilityScore] = useState(null);

  useEffect(() => {
    fetchAnalytics();
    fetchSustainabilityScore();
  }, [period]);

  const fetchAnalytics = () => {
    setLoading(true);
    api.get(`/analytics/dashboard?period=${period}`, { 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
    })
      .then(res => {
        setAnalytics(res.data.dashboard);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch analytics');
        setLoading(false);
      });
  };

  const fetchSustainabilityScore = () => {
    api.get(`/analytics/sustainability-score?period=${period}`, { 
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
    })
      .then(res => {
        setSustainabilityScore(res.data);
      })
      .catch(() => {
        console.error('Failed to fetch sustainability score');
      });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreCategory = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
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
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-lg">Loading analytics...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      ) : analytics ? (
        <>
          {/* Sustainability Score */}
          {sustainabilityScore && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-4">Overall Sustainability Score</h3>
              <div className="flex items-center space-x-4">
                <div className={`text-4xl font-bold ${getScoreColor(sustainabilityScore.overallScore)}`}>
                  {sustainabilityScore.overallScore}/100
                </div>
                <div>
                  <div className="text-lg font-semibold">{getScoreCategory(sustainabilityScore.overallScore)}</div>
                  <div className="text-sm text-gray-600">Sustainability Rating</div>
                </div>
              </div>
              {sustainabilityScore.recommendations && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {sustainabilityScore.recommendations.slice(0, 3).map((rec, index) => (
                      <li key={index} className="text-gray-700">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalShipments)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Carbon Emissions</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalCarbon)} kg</p>
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
                  <p className="text-sm font-medium text-gray-600">Avg Carbon/Shipment</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.avgCarbonPerShipment)} kg</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Suppliers</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.summary.totalSuppliers)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">ESG Performance</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average ESG Score</span>
                  <span className="font-semibold">{formatNumber(analytics.summary.avgESGScore)}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Green Products</span>
                  <span className="font-semibold">{formatNumber(analytics.summary.totalProducts)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Green Score</span>
                  <span className="font-semibold">{formatNumber(analytics.summary.avgGreenScore)}/100</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Waste Management</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Alerts</span>
                  <span className="font-semibold text-yellow-600">{analytics.summary.activeAlerts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Critical Alerts</span>
                  <span className="font-semibold text-red-600">{analytics.summary.criticalAlerts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Alert Rate</span>
                  <span className="font-semibold">{analytics.summary.totalShipments > 0 ? formatPercentage((analytics.summary.activeAlerts / analytics.summary.totalShipments) * 100) : '0%'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Transport Efficiency</h3>
              <div className="space-y-3">
                {analytics.efficiency && analytics.efficiency.transportModes && Object.entries(analytics.efficiency.transportModes).slice(0, 3).map(([mode, count]) => (
                  <div key={mode} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{mode}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Carbon Trends Chart */}
          {analytics.trends && analytics.trends.dailyCarbon && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Daily Carbon Emissions</h3>
              <div className="h-64 flex items-end justify-between space-x-2">
                {analytics.trends.dailyCarbon.slice(-7).map((day, index) => {
                  const maxCarbon = Math.max(...analytics.trends.dailyCarbon.map(d => d.carbon));
                  const height = maxCarbon > 0 ? (day.carbon / maxCarbon) * 100 : 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="bg-blue-500 rounded-t w-full"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs font-medium">{formatNumber(day.carbon)} kg</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transport Mode Distribution */}
          {analytics.efficiency && analytics.efficiency.carbonByMode && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Carbon Emissions by Transport Mode</h3>
              <div className="space-y-4">
                {Object.entries(analytics.efficiency.carbonByMode).map(([mode, data]) => (
                  <div key={mode} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                      <span className="font-medium capitalize">{mode}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatNumber(data.total)} kg</div>
                      <div className="text-sm text-gray-500">{data.count} shipments</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Potential Savings */}
          {analytics.efficiency && analytics.efficiency.potentialSavings && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Potential Savings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(analytics.efficiency.potentialSavings.carbonReduction)} kg
                  </div>
                  <div className="text-sm text-gray-600">Carbon Reduction</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    ${formatNumber(analytics.efficiency.potentialSavings.costSavings)}
                  </div>
                  <div className="text-sm text-gray-600">Cost Savings</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatNumber(analytics.efficiency.potentialSavings.wasteReduction)} kg
                  </div>
                  <div className="text-sm text-gray-600">Waste Reduction</div>
                </div>
              </div>
            </div>
          )}

          {/* Carbon Saved Over Time */}
          <div className="card mt-8">
            <h3 className="text-lg font-semibold mb-4">Carbon Saved Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.dailyAdoption || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="ecoAdoptions" stroke="#16a34a" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Analytics; 