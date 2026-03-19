import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { FormField, Input } from '../../components/shared/FormField';
import toast from 'react-hot-toast';
import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  AcademicCapIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@prmportal.com', role: 'admin', color: 'bg-red-500' },
  { label: 'Channel Manager', email: 'sarah.chen@prmportal.com', role: 'channel_manager', color: 'bg-purple-500' },
  { label: 'Partner Admin (Diamond)', email: 'admin@cybershield.com', role: 'partner_admin', color: 'bg-panw-blue' },
  { label: 'Partner Admin (Platinum)', email: 'admin@cloudguard.io', role: 'partner_admin', color: 'bg-panw-teal' },
  { label: 'Partner Rep', email: 'rep@cybershield.com', role: 'partner_rep', color: 'bg-amber-500' },
];

const DEMO_PASSWORD = 'Demo123!';

const FEATURES = [
  {
    icon: CurrencyDollarIcon,
    title: 'Deal Registration',
    description: 'Register and track deals with real-time conflict detection',
  },
  {
    icon: DocumentTextIcon,
    title: 'CPQ Quoting',
    description: 'Configure, price, and quote with tier-aware discounts',
  },
  {
    icon: UserGroupIcon,
    title: 'Lead Distribution',
    description: 'Receive and manage qualified leads with SLA tracking',
  },
  {
    icon: BanknotesIcon,
    title: 'MDF Management',
    description: 'Request and claim marketing development funds',
  },
  {
    icon: AcademicCapIcon,
    title: 'Training & Certs',
    description: 'Complete courses and earn certifications to advance your tier',
  },
  {
    icon: ChartBarIcon,
    title: 'Performance Analytics',
    description: 'Track pipeline, revenue, and program performance metrics',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      toast.error(message);
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel -- PANW NextWave branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-panw-navy relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-panw-blue/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-panw-teal/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-panw-orange/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 lg:p-16">
          {/* Logo / Title */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-panw-orange flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">PRM Portal</h1>
                <p className="text-xs font-medium text-panw-teal tracking-widest uppercase">
                  NextWave Partner Portal
                </p>
              </div>
            </div>
            <p className="text-white/60 text-lg leading-relaxed mt-6 max-w-md">
              Your all-in-one platform for managing the partner lifecycle -- from deal
              registration to revenue growth.
            </p>
          </div>

          {/* Feature list */}
          <div className="grid grid-cols-1 gap-4 max-w-md">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-3 rounded-lg bg-white/5 p-3 backdrop-blur-sm"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-panw-orange/20">
                    <Icon className="h-4 w-4 text-panw-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {feature.title}
                    </p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer text */}
          <p className="mt-12 text-xs text-white/30">
            Partner Relationship Management Platform
          </p>
        </div>
      </div>

      {/* Right panel -- login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-panw-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-panw-orange flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-panw-navy">PRM Portal</h1>
                <p className="text-[10px] font-medium text-panw-teal tracking-widest uppercase">
                  NextWave Partner Portal
                </p>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-xl shadow-panw-md p-8 border border-panw-gray-100">
            <h2 className="text-2xl font-bold text-panw-gray-800 mb-1">Sign in</h2>
            <p className="text-sm text-panw-gray-400 mb-8">
              Enter your credentials to access your partner portal.
            </p>

            {errors.form && (
              <div
                className="mb-4 rounded-md bg-red-50 border border-red-200 p-3"
                role="alert"
              >
                <p className="text-sm text-red-700">{errors.form}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <FormField
                label="Email address"
                htmlFor="email"
                error={errors.email}
                required
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  hasError={!!errors.email}
                  placeholder="you@company.com"
                />
              </FormField>

              <FormField
                label="Password"
                htmlFor="password"
                error={errors.password}
                required
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hasError={!!errors.password}
                  placeholder="Enter your password"
                />
              </FormField>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-panw-gray-500">
                  <input
                    type="checkbox"
                    className="rounded border-panw-gray-300 text-panw-blue focus:ring-panw-blue"
                  />
                  Remember me
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-panw-blue hover:text-panw-navy"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-panw-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-panw-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-panw-blue hover:text-panw-navy"
              >
                Register your company
              </Link>
            </p>
          </div>

          {/* Demo quick-login buttons */}
          <div className="mt-4 rounded-lg bg-panw-teal/5 border border-panw-teal/20 p-4">
            <p className="text-xs font-semibold text-panw-teal mb-2">Quick Demo Login</p>
            <div className="flex flex-col gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    setErrors({});
                  }}
                  className="flex items-center gap-2 w-full text-left rounded-md px-2.5 py-1.5 text-xs hover:bg-panw-teal/10 transition-colors group"
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${account.color} flex-shrink-0`} />
                  <span className="font-medium text-panw-gray-700 group-hover:text-panw-navy">
                    {account.label}
                  </span>
                  <span className="text-panw-gray-400 ml-auto font-mono text-[10px]">
                    {account.email}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-panw-gray-400 mt-2 pt-2 border-t border-panw-teal/10">
              Password for all accounts: <span className="font-mono font-semibold text-panw-gray-600">Demo123!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
