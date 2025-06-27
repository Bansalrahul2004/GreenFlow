import React, { useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
  const { user, setUser } = useContext(AuthContext);
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '', preferences: {} });
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        const u = res.data.user;
        setForm({
          name: u.name || '',
          email: u.email || '',
          company: u.company || '',
          role: u.role || '',
          preferences: u.preferences || {}
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to load profile.');
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const res = await api.put('/auth/profile', { name: form.name, company: form.company }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data.user);
      setSuccess('Profile updated successfully.');
      setEdit(false);
    } catch (err) {
      setError('Failed to update profile.');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white p-8 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Profile</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {success && <div className="text-green-600 mb-2">{success}</div>}
      <form onSubmit={handleSave}>
        <div className="mb-4">
          <label className="block font-medium mb-1">Name</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full border px-3 py-2 rounded" disabled={!edit} />
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Email</label>
          <input type="email" name="email" value={form.email} className="w-full border px-3 py-2 rounded bg-gray-100" disabled readOnly />
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Company</label>
          <input type="text" name="company" value={form.company} onChange={handleChange} className="w-full border px-3 py-2 rounded" disabled={!edit} />
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Role</label>
          <input type="text" name="role" value={form.role} className="w-full border px-3 py-2 rounded bg-gray-100" disabled readOnly />
        </div>
        {edit ? (
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
        ) : (
          <button type="button" className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300" onClick={() => setEdit(true)}>Edit</button>
        )}
      </form>
    </div>
  );
};

export default Profile; 