import React, { useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'consumer', company: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [roles] = useState(['consumer', 'supplier']);
  const certificationLevels = [
    'None', 'Basic', 'FairTrade', 'Organic', 'B Corp', 'Carbon Neutral'
  ];

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const submitData = { ...form };
      if (form.role === 'supplier') {
        if (!form.certificationLevel || !form.ESGscore) {
          setError('Certification Level and ESG Score are required for suppliers.');
          setLoading(false);
          return;
        }
        submitData.certificationLevel = form.certificationLevel;
        submitData.ESGscore = Number(form.ESGscore);
      }
      const res = await api.post('/auth/register', submitData);
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      setUser(user);
      setLoading(false);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.error || 'Registration failed. Please check your details.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-center">Register for GreenFlow</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-1 font-medium">Name</label>
          <input
            type="text"
            name="name"
            className="w-full border px-3 py-2 rounded"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            name="email"
            className="w-full border px-3 py-2 rounded"
            value={form.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block mb-1 font-medium">Password</label>
          <input
            type="password"
            name="password"
            className="w-full border px-3 py-2 rounded"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="block mb-1 font-medium">Role</label>
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
            required
          >
            <option value="">Select role</option>
            {roles.map(role => (
              <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
            ))}
          </select>
        </div>
        {form.role === 'supplier' && (
          <>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Company</label>
              <input
                type="text"
                name="company"
                className="w-full border px-3 py-2 rounded"
                value={form.company}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">Certification Level</label>
              <select
                name="certificationLevel"
                value={form.certificationLevel || ''}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
                required
              >
                <option value="">Select certification level</option>
                {certificationLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block mb-1 font-medium">ESG Score</label>
              <input
                type="number"
                name="ESGscore"
                className="w-full border px-3 py-2 rounded"
                value={form.ESGscore || ''}
                onChange={handleChange}
                min="0"
                max="100"
                required
              />
            </div>
          </>
        )}
        {error && <p className="text-red-600 mb-3">{error}</p>}
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default Register; 