import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const PendingSuppliers = () => {
  const { user } = useContext(AuthContext);
  const [pendingSuppliers, setPendingSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    fetchPendingSuppliers();
    // eslint-disable-next-line
  }, []);

  const fetchPendingSuppliers = () => {
    setLoading(true);
    api.get('/suppliers/pending', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        setPendingSuppliers(res.data.suppliers || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch pending suppliers');
        setLoading(false);
      });
  };

  const handleStatusChange = async (id, status) => {
    setActionError('');
    setActionSuccess('');
    try {
      await api.put(`/suppliers/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActionSuccess(`Supplier ${status}`);
      fetchPendingSuppliers();
    } catch (err) {
      setActionError('Failed to update supplier status.');
    }
  };

  if (user?.role !== 'manager' && user?.role !== 'admin') {
    return <div className="p-8">Access denied.</div>;
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Pending Suppliers</h2>
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Email</th>
              <th className="py-2 px-4 border-b">Certification</th>
              <th className="py-2 px-4 border-b">ESG Score</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingSuppliers.map(supplier => (
              <tr key={supplier._id}>
                <td className="py-2 px-4 border-b">{supplier.name}</td>
                <td className="py-2 px-4 border-b">{supplier.email}</td>
                <td className="py-2 px-4 border-b">{supplier.certificationLevel}</td>
                <td className="py-2 px-4 border-b">{supplier.ESGscore}</td>
                <td className="py-2 px-4 border-b">
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded mr-2 hover:bg-green-700"
                    onClick={() => handleStatusChange(supplier._id, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    onClick={() => handleStatusChange(supplier._id, 'rejected')}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {actionError && <p className="text-red-600 mt-2">{actionError}</p>}
      {actionSuccess && <p className="text-green-600 mt-2">{actionSuccess}</p>}
    </div>
  );
};

export default PendingSuppliers; 