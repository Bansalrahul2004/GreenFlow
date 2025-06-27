import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Shipments = () => {
  const { user } = useContext(AuthContext);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    supplierId: user?.supplierId || '',
    productId: '',
    quantity: '',
    distanceKm: '',
    transportMode: 'diesel',
    vehicleType: 'truck',
    packagingWeight: '',
    estimatedDelivery: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState('');
  const [transportModes] = useState(['diesel', 'electric', 'hybrid', 'rail', 'ship', 'air']);
  const [vehicleTypes] = useState(['truck', 'van', 'car', 'train', 'ship', 'plane']);

  useEffect(() => {
    fetchShipments();
    fetchProducts();
  }, []);

  const fetchShipments = () => {
    setLoading(true);
    api.get('/shipments', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => {
        setShipments(res.data.shipments || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch shipments');
        setLoading(false);
      });
  };

  const fetchProducts = () => {
    api.get('/products', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => setProducts(res.data.products || []));
  };

  const fetchSuppliers = () => {
    setSuppliersLoading(true);
    setSuppliersError('');
    api.get('/suppliers', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => {
        setSuppliers(Array.isArray(res.data) ? res.data : (res.data.suppliers || []));
        setSuppliersLoading(false);
      })
      .catch(() => {
        setSuppliersError('Failed to fetch suppliers');
        setSuppliersLoading(false);
      });
  };

  const handleInputChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setForm({
      supplierId: user?.supplierId || '', productId: '', quantity: '', distanceKm: '', transportMode: 'diesel', vehicleType: 'truck', packagingWeight: '', estimatedDelivery: '', notes: ''
    });
    setEditId(null);
    setShowModal(true);
    setFormError('');
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchSuppliers();
    }
  };

  const openEditModal = shipment => {
    setForm({
      supplierId: shipment.supplierId?._id || shipment.supplierId,
      productId: shipment.productId?._id || shipment.productId,
      quantity: shipment.quantity,
      distanceKm: shipment.distanceKm,
      transportMode: shipment.transportMode,
      vehicleType: shipment.vehicleType,
      packagingWeight: shipment.packagingWeight,
      estimatedDelivery: shipment.estimatedDelivery ? shipment.estimatedDelivery.slice(0, 10) : '',
      notes: shipment.notes || ''
    });
    setEditId(shipment._id);
    setShowModal(true);
    setFormError('');
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchSuppliers();
    }
  };

  const handleAddOrEditShipment = async e => {
    e.preventDefault();
    setFormError('');
    
    // Enhanced validation with specific field checks
    const requiredFields = [
      { key: 'productId', label: 'Product' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'distanceKm', label: 'Distance' },
      { key: 'transportMode', label: 'Transport Mode' }
    ];
    
    for (const field of requiredFields) {
      if (!form[field.key] || form[field.key] === '') {
        setFormError(`${field.label} is required.`);
        return;
      }
    }
    
    // Additional validation for quantity (minimum 1 as per backend)
    if (Number(form.quantity) < 1) {
      setFormError('Quantity must be at least 1.');
      return;
    }
    
    // Ensure supplierId is set for suppliers
    if (user?.role === 'supplier' && !form.supplierId) {
      setForm.supplierId = user.supplierId;
    }
    
    setSubmitting(true);
    try {
      const shipmentData = {
        ...form,
        quantity: Number(form.quantity),
        distanceKm: Number(form.distanceKm),
        packagingWeight: Number(form.packagingWeight) || 0
      };
      
      if (editId) {
        await api.put(`/shipments/${editId}`,
          shipmentData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        toast.success('Shipment updated!');
      } else {
        await api.post('/shipments',
          shipmentData,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        toast.success('Shipment added!');
      }
      setShowModal(false);
      setForm({ supplierId: user?.supplierId || '', productId: '', quantity: '', distanceKm: '', transportMode: 'diesel', vehicleType: 'truck', packagingWeight: '', estimatedDelivery: '', notes: '' });
      setEditId(null);
      fetchShipments();
    } catch (err) {
      console.error('Shipment save error:', err);
      if (err.response?.data?.error) {
        setFormError(err.response.data.error);
        toast.error(err.response.data.error);
      } else if (err.response?.data?.errors) {
        setFormError(err.response.data.errors[0]?.msg || 'Validation error');
        toast.error(err.response.data.errors[0]?.msg || 'Validation error');
      } else {
        setFormError('Failed to save shipment.');
        toast.error('Failed to save shipment.');
      }
    }
    setSubmitting(false);
  };

  const handleDeleteShipment = async id => {
    try {
      await api.delete(`/shipments/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchShipments();
      toast.success('Shipment deleted!');
    } catch (err) {
      alert('Failed to delete shipment.');
      toast.error('Failed to delete shipment.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Shipments</h2>
        {user?.role === 'supplier' && (
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={openAddModal}
          >
            Add Shipment
          </button>
        )}
      </div>
      {loading ? (
        <p>Loading shipments...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Product</th>
              <th className="py-2 px-4 border-b">Supplier</th>
              <th className="py-2 px-4 border-b">Quantity</th>
              <th className="py-2 px-4 border-b">Distance (km)</th>
              <th className="py-2 px-4 border-b">Transport</th>
              <th className="py-2 px-4 border-b">Vehicle</th>
              <th className="py-2 px-4 border-b">Packaging (kg)</th>
              <th className="py-2 px-4 border-b">Est. Delivery</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(shipment => (
              <tr key={shipment._id} className="table-row">
                <td className="py-2 px-4 border-b">{shipment.productId?.name || '-'}</td>
                <td className="py-2 px-4 border-b">{shipment.supplierId?.name || '-'}</td>
                <td className="py-2 px-4 border-b">{shipment.quantity}</td>
                <td className="py-2 px-4 border-b">{shipment.distanceKm}</td>
                <td className="py-2 px-4 border-b">{shipment.transportMode}</td>
                <td className="py-2 px-4 border-b">{shipment.vehicleType}</td>
                <td className="py-2 px-4 border-b">{shipment.packagingWeight}</td>
                <td className="py-2 px-4 border-b">{shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleDateString() : '-'}</td>
                <td className="py-2 px-4 border-b">
                  {(user?.role === 'manager' || (user?.role === 'supplier' && user?.supplierId === (shipment.supplierId?._id || shipment.supplierId))) && (
                    <>
                      <button
                        className="button button-blue mr-2"
                        onClick={() => openEditModal(shipment)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-red"
                        onClick={() => handleDeleteShipment(shipment._id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add/Edit Shipment Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editId ? 'Edit Shipment' : 'Add Shipment'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="shipment-form" onSubmit={handleAddOrEditShipment}>
                {user?.role === 'manager' && (
                  <div className="mb-3">
                    <label className="block mb-1 font-medium">Supplier</label>
                    {suppliersLoading ? (
                      <p>Loading suppliers...</p>
                    ) : suppliersError ? (
                      <p className="text-red-600">{suppliersError}</p>
                    ) : (
                      <select
                        name="supplierId"
                        value={form.supplierId}
                        onChange={handleInputChange}
                        className="w-full border px-3 py-2 rounded"
                        required
                      >
                        <option value="">Select supplier</option>
                        {suppliers.map(sup => (
                          <option key={sup._id} value={sup._id}>{sup.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {user?.role === 'supplier' && (
                  <input type="hidden" name="supplierId" value={form.supplierId} />
                )}
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Product</label>
                  <select
                    name="productId"
                    value={form.productId}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  >
                    <option value="">Select product</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                    min="1"
                    step="0.1"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Distance (km)</label>
                  <input
                    type="number"
                    name="distanceKm"
                    value={form.distanceKm}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Transport Mode</label>
                  <select
                    name="transportMode"
                    value={form.transportMode}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  >
                    {transportModes.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Vehicle Type</label>
                  <select
                    name="vehicleType"
                    value={form.vehicleType}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                  >
                    {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Packaging Weight (kg)</label>
                  <input
                    type="number"
                    name="packagingWeight"
                    value={form.packagingWeight}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Estimated Delivery</label>
                  <input
                    type="date"
                    name="estimatedDelivery"
                    value={form.estimatedDelivery}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    rows="3"
                  />
                </div>
                {formError && <p className="text-red-600 mb-2">{formError}</p>}
              </form>
            </div>
            <div className="p-6 border-t bg-gray-50">
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
                  form="shipment-form"
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? (editId ? 'Saving...' : 'Adding...') : (editId ? 'Save Changes' : 'Add Shipment')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments; 