import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { UserPlus, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time password policy checks
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please provide all required fields.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet the complexity requirements.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await register({
        name,
        email,
        password,
        company: company || undefined,
        phone: phone || undefined,
        gstin: gstin || undefined,
      });
      toast.success('Registration successful! Please sign in with your credentials.');
      navigate('/login');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed.';
      setError(typeof msg === 'string' ? msg : msg[0]);
      toast.error('Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #1f2937 0%, #0b0f19 80%)',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 className="h1" style={{ fontSize: '1.75rem' }}>
            Create Customer Account
          </h1>
          <p style={{ marginTop: 6, fontSize: '0.875rem' }}>
            Sign up to access self-service subscription plans and invoices
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
              label="Full Name *"
              placeholder="e.g. Acme Corp / John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Work Email *"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password *"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {/* Password Policy Criteria Checklist */}
            <div
              style={{
                background: 'var(--bg-elevated)',
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
                fontSize: '0.75rem',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Password Requirements:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <span style={{ color: hasMinLength ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasMinLength ? <Check size={12} /> : <X size={12} />} At least 8 characters
                </span>
                <span style={{ color: hasUpper ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasUpper ? <Check size={12} /> : <X size={12} />} 1 Uppercase letter
                </span>
                <span style={{ color: hasLower ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasLower ? <Check size={12} /> : <X size={12} />} 1 Lowercase letter
                </span>
                <span style={{ color: hasNumber ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasNumber ? <Check size={12} /> : <X size={12} />} 1 Number
                </span>
                <span style={{ color: hasSpecial ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hasSpecial ? <Check size={12} /> : <X size={12} />} 1 Special symbol
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Company Name"
                placeholder="Acme Global"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <Input
                label="Phone"
                placeholder="+91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <Input
              label="GSTIN (Optional)"
              placeholder="29AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />

            <Button
              type="submit"
              variant="primary"
              style={{ width: '100%', marginTop: 8 }}
              isLoading={isLoading}
              disabled={!isPasswordValid}
              icon={<UserPlus size={16} />}
            >
              Register Account
            </Button>
          </form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8125rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
