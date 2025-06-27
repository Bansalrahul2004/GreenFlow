import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Products = () => {
  const { user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    supplierId: '',
    price: '',
    unit: 'kg',
    packagingType: 'plastic',
    shelfLife: '',
    description: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [categories] = useState([
    'Fresh Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Beverages', 'Frozen', 'Household', 'Electronics', 'Clothing'
  ]);
  const [units] = useState(['kg', 'lb', 'piece', 'liter', 'gallon', 'box', 'bottle']);
  const [packagingTypes] = useState(['plastic', 'recyclable', 'compostable', 'biodegradable', 'minimal']);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = () => {
    setLoading(true);
    api.get('/products', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => {
        setProducts(res.data.products || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch products');
        setLoading(false);
      });
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
      name: '', sku: '', category: '', supplierId: user?.supplierId || '', price: '', unit: 'kg', packagingType: 'plastic', shelfLife: '', description: ''
    });
    setEditId(null);
    setShowModal(true);
    setFormError('');
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchSuppliers();
    }
  };

  const openEditModal = product => {
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      supplierId: product.supplierId?._id || product.supplierId,
      price: product.price,
      unit: product.unit,
      packagingType: product.packagingType,
      shelfLife: product.shelfLife,
      description: product.description || ''
    });
    setEditId(product._id);
    setShowModal(true);
    setFormError('');
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchSuppliers();
    }
  };

  const handleAddOrEditProduct = async e => {
    e.preventDefault();
    setFormError('');
    console.log('Submitting form:', form); // Debug: log form state
    // Improved validation: check each required field and show which is missing
    const requiredFields = [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'category', label: 'Category' },
      { key: 'supplierId', label: 'Supplier' },
      { key: 'price', label: 'Price' },
      { key: 'unit', label: 'Unit' },
      { key: 'packagingType', label: 'Packaging Type' }
    ];
    for (const field of requiredFields) {
      if (!form[field.key] || form[field.key] === '') {
        setFormError(`${field.label} is required.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (editId) {
        await api.put(`/products/${editId}`,
          { ...form, price: Number(form.price), shelfLife: Number(form.shelfLife) },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        toast.success('Product updated!');
      } else {
        await api.post('/products',
          { ...form, price: Number(form.price), shelfLife: Number(form.shelfLife) },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        toast.success('Product added!');
      }
      setShowModal(false);
      setForm({ name: '', sku: '', category: '', supplierId: user?.supplierId || '', price: '', unit: 'kg', packagingType: 'plastic', shelfLife: '', description: '' });
      setEditId(null);
      fetchProducts();
    } catch (err) {
      setFormError('Failed to save product.');
      toast.error('Failed to save product.');
    }
    setSubmitting(false);
  };

  const handleDeleteProduct = async id => {
    try {
      await api.delete(`/products/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      fetchProducts();
      toast.success('Product deleted!');
    } catch (err) {
      alert('Failed to delete product.');
      toast.error('Failed to delete product.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Products</h2>
        {user?.role === 'supplier' && (
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={openAddModal}
          >
            Add Product
          </button>
        )}
      </div>
      {loading ? (
        <p>Loading products...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <table className="min-w-full bg-white border rounded shadow">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">SKU</th>
              <th className="py-2 px-4 border-b">Category</th>
              <th className="py-2 px-4 border-b">Supplier</th>
              <th className="py-2 px-4 border-b">Price</th>
              <th className="py-2 px-4 border-b">Unit</th>
              <th className="py-2 px-4 border-b">Packaging</th>
              <th className="py-2 px-4 border-b">Shelf Life</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product._id} className="table-row">
                <td className="py-2 px-4 border-b flex items-center gap-2">
                  {product.name}
                  {(product.ESGscore >= 80 || product.packagingType === 'minimal') && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold ml-2">
                      <CheckBadgeIcon className="w-4 h-4 mr-1 text-green-600" /> Eco
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 border-b">{product.sku}</td>
                <td className="py-2 px-4 border-b">{product.category}</td>
                <td className="py-2 px-4 border-b">{product.supplierId?.name || '-'}</td>
                <td className="py-2 px-4 border-b">${product.price}</td>
                <td className="py-2 px-4 border-b">{product.unit}</td>
                <td className="py-2 px-4 border-b">{product.packagingType}</td>
                <td className="py-2 px-4 border-b">{product.shelfLife}</td>
                <td className="py-2 px-4 border-b">
                  {(user?.role === 'manager' || (user?.role === 'supplier' && user?.supplierId === (product.supplierId?._id || product.supplierId))) && (
                    <>
                      <button
                        className="button button-blue mr-2"
                        onClick={() => openEditModal(product)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-red"
                        onClick={() => handleDeleteProduct(product._id)}
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

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editId ? 'Edit Product' : 'Add Product'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleAddOrEditProduct}>
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
                  <label className="block mb-1 font-medium">SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={form.sku}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                    disabled={!!editId}
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Category</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                {(user?.role === 'admin' || user?.role === 'manager') && (
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
                  <label className="block mb-1 font-medium">Price</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                    min="0"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Unit</label>
                  <select
                    name="unit"
                    value={form.unit}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  >
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Packaging Type</label>
                  <select
                    name="packagingType"
                    value={form.packagingType}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    required
                  >
                    {packagingTypes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Shelf Life (days)</label>
                  <input
                    type="number"
                    name="shelfLife"
                    value={form.shelfLife}
                    onChange={handleInputChange}
                    className="w-full border px-3 py-2 rounded"
                    min="1"
                  />
                </div>
                <div className="mb-3">
                  <label className="block mb-1 font-medium">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
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
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  disabled={submitting}
                  onClick={handleAddOrEditProduct}
                >
                  {submitting ? (editId ? 'Saving...' : 'Adding...') : (editId ? 'Save Changes' : 'Add Product')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products; 