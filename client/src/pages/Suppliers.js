import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

const Suppliers = () => {
  const { user } = useContext(AuthContext);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    certificationLevel: '',
    ESGscore: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showDeleteId, setShowDeleteId] = useState(null);
  const [certificationLevels] = useState([
    'None', 'Basic', 'FairTrade', 'Organic', 'B Corp', 'Carbon Neutral'
  ]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = () => {
    setLoading(true);
    api.get('/suppliers', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        setSuppliers(res.data.suppliers || res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch suppliers');
        setLoading(false);
      });
  };

  const handleInputChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setForm({ name: '', email: '', certificationLevel: '', ESGscore: '' });
    setEditId(null);
    setShowModal(true);
    setFormError('');
  };

  const openEditModal = supplier => {
    setForm({
      name: supplier.name,
      email: supplier.email || '',
      certificationLevel: supplier.certificationLevel,
      ESGscore: supplier.ESGscore,
    });
    setEditId(supplier._id);
    setShowModal(true);
    setFormError('');
  };

  const handleAddOrEditSupplier = async e => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.email || !form.certificationLevel || !form.ESGscore) {
      setFormError('All fields are required.');
      return;
    }
    setSubmitting(true);
    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      if (editId) {
        await api.put(`/suppliers/${editId}`, {
          name: form.name,
          email: form.email,
          certificationLevel: form.certificationLevel,
          ESGscore: Number(form.ESGscore),
        }, config);
      } else {
        await api.post('/suppliers', {
          name: form.name,
          email: form.email,
          certificationLevel: form.certificationLevel,
          ESGscore: Number(form.ESGscore),
        }, config);
      }
      setShowModal(false);
      setForm({ name: '', email: '', certificationLevel: '', ESGscore: '' });
      setEditId(null);
      fetchSuppliers();
    } catch (err) {
      setFormError('Failed to save supplier.');
    }
    setSubmitting(false);
  };

  const handleDeleteSupplier = async id => {
    try {
      const config = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
      await api.delete(`/suppliers/${id}`, config);
      setShowDeleteId(null);
      fetchSuppliers();
    } catch (err) {
      alert('Failed to delete supplier.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Suppliers</h2>
        {/* No Add Supplier button for suppliers */}
      </div>
      {user?.role === 'supplier' ? (
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Certification</th>
              <th className="py-2 px-4 border-b">ESG Score</th>
              <th className="py-2 px-4 border-b">Registered</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.filter(s => s._id === user.supplierId).map(supplier => (
              <tr key={supplier._id} className="table-row">
                <td className="py-2 px-4 border-b">{supplier.name}</td>
                <td className="py-2 px-4 border-b flex items-center gap-2">
                  {supplier.certificationLevel}
                  {supplier.certificationLevel && supplier.certificationLevel !== 'None' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold ml-2">
                      <CheckBadgeIcon className="w-4 h-4 mr-1 text-green-600" />
                      {supplier.certificationLevel}
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 border-b">
                  <div className="w-24 bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${supplier.ESGscore}%` }}></div>
                  </div>
                  <span className="text-xs ml-2">{supplier.ESGscore}</span>
                </td>
                <td className="py-2 px-4 border-b">{new Date(supplier.registeredAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : loading ? (
        <p>Loading suppliers...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Certification</th>
              <th className="py-2 px-4 border-b">ESG Score</th>
              <th className="py-2 px-4 border-b">Registered</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(supplier => (
              <tr key={supplier._id} className="table-row">
                <td className="py-2 px-4 border-b">{supplier.name}</td>
                <td className="py-2 px-4 border-b flex items-center gap-2">
                  {supplier.certificationLevel}
                  {supplier.certificationLevel && supplier.certificationLevel !== 'None' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold ml-2">
                      <CheckBadgeIcon className="w-4 h-4 mr-1 text-green-600" />
                      {supplier.certificationLevel}
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 border-b">
                  <div className="w-24 bg-gray-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full" style={{ width: `${supplier.ESGscore}%` }}></div>
                  </div>
                  <span className="text-xs ml-2">{supplier.ESGscore}</span>
                </td>
                <td className="py-2 px-4 border-b">{new Date(supplier.registeredAt).toLocaleDateString()}</td>
                <td className="py-2 px-4 border-b">
                  <button
                    className="button button-blue mr-2"
                    onClick={() => openEditModal(supplier)}
                  >
                    Edit
                  </button>
                  <button
                    className="button button-red"
                    onClick={() => setShowDeleteId(supplier._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editId ? 'Edit Supplier' : 'Add Supplier'}</h3>
            <form onSubmit={handleAddOrEditSupplier}>
              <div className="mb-3">
                <label className="block mb-1 font-medium">Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block mb-1 font-medium">Email</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block mb-1 font-medium">Certification Level</label>
                <select
                  name="certificationLevel"
                  value={form.certificationLevel}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                >
                  <option value="">Select certification level</option>
                  {certificationLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block mb-1 font-medium">ESG Score</label>
                <input
                  type="number"
                  name="ESGscore"
                  value={form.ESGscore}
                  onChange={handleInputChange}
                  className="w-full border px-3 py-2 rounded"
                  required
                  min="0"
                  max="100"
                />
              </div>
              {formError && <p className="text-red-600 mb-2">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? (editId ? 'Saving...' : 'Adding...') : (editId ? 'Save Changes' : 'Add Supplier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Delete Supplier</h3>
            <p>Are you sure you want to delete this supplier?</p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                onClick={() => setShowDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => handleDeleteSupplier(showDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers; 