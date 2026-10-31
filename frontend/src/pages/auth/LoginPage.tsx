import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LogIn, Shield, Users, User } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await login({ email, password });
      toast.success(`Welcome back, ${user.name}!`);

      if (from !== '/') {
        navigate(from, { replace: true });
      } else if (user.role === Role.CUSTOMER) {
        navigate('/portal', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid email or password.';
      setError(typeof msg === 'string' ? msg : msg[0]);
      toast.error('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPassword: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
    toast.info(`Filled credentials for ${demoRole}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #1f2937 0%, #0b0f19 80%)',
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: 16,
              boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.5)',
            }}
          >
            S
          </div>
          <h1 className="h1" style={{ fontSize: '1.875rem' }}>
            SubFlow Enterprise
          </h1>
          <p style={{ marginTop: 6, fontSize: '0.875rem' }}>
            Subscription Billing, Automated Ledger & Financial Analytics
          </p>
        </div>

        <Card style={{ padding: 28, background: 'var(--bg-surface)' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-light)',
                border: '1px solid var(--danger)',
                color: '#f87171',
                fontSize: '0.8125rem',
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Input
              label="Email Address"
              type="email"
              placeholder="admin@brightloop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              style={{ width: '100%', marginTop: 8 }}
              isLoading={isLoading}
              icon={<LogIn size={16} />}
            >
              Sign In to Platform
            </Button>
          </form>

          {/* Quick Demo Autofill section */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
            <span
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: 600,
                display: 'block',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              Quick Test Personas
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 8px', flexDirection: 'column', gap: 4 }}
                onClick={() => handleDemoFill('admin@brightloop.com', 'Admin@12345', 'Admin')}
              >
                <Shield size={14} color="#f87171" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 8px', flexDirection: 'column', gap: 4 }}
                onClick={() => handleDemoFill('staff1@brightloop.com', 'Staff@12345', 'Staff')}
              >
                <Users size={14} color="#818cf8" />
                <span>Staff</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 8px', flexDirection: 'column', gap: 4 }}
                onClick={() => handleDemoFill('rohithkarthik275@gmail.com', 'Rohith@13012007', 'Customer')}
              >
                <User size={14} color="#34d399" />
                <span>Customer</span>
              </button>
            </div>
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Don't have an account yet? </span>
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Register as Customer
          </Link>
        </div>
      </div>
    </div>
  );
};

