import React, { useState } from 'react';
import { Sprout, Smartphone, Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { Language, User, UserRole } from '../types';

interface AuthScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onAuthSuccess: (token: string, user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language,
  onLanguageChange,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');

  const [phone, setPhone] = useState('9822011223');
  const [otp, setOtp] = useState('');
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const [email, setEmail] = useState('admin@sahyadrifpo.in');
  const [password, setPassword] = useState('AgriNexus@2026');

  const [name, setName] = useState('');
  const [locality, setLocality] = useState('Nashik');
  const [role, setRole] = useState<UserRole>('farmer');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isHi = language === 'hi';

  async function handleRequestOtp() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await api.requestOtp(phone);
      setOtpSent(true);
      setDevOtpPreview(res.devPreviewCode);
      setInfo(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (authMethod === 'otp') {
        const res = await api.verifyOtp(phone, otp);
        onAuthSuccess(res.token, res.user);
      } else {
        const res = await api.login(email, password);
        onAuthSuccess(res.token, res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register({
        name,
        phone: role === 'farmer' ? phone : undefined,
        email: role !== 'farmer' ? email : undefined,
        password: role !== 'farmer' ? password : undefined,
        otp: role === 'farmer' && otp ? otp : undefined,
        role,
        locality,
        languagePreference: language,
      });
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoverSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.recoverAccount(phone, otp, newPassword || undefined);
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account recovery failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(demoRole: UserRole) {
    setError(null);
    setLoading(true);
    try {
      const res = await api.demoLogin(demoRole);
      onAuthSuccess(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col">
      <header className="w-full border-b border-[#E2E6DF] bg-white px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <Sprout className="w-5 h-5 text-emerald-700" />
          <span className="font-display text-lg font-bold tracking-tight text-[#141A15]">
            AgriNexus
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F1F3EF] rounded-md border border-[#E2E6DF]">
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              language === 'en'
                ? 'bg-white text-[#141A15] shadow-xs'
                : 'text-[#4B554D] hover:text-[#141A15]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('hi')}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
              language === 'hi'
                ? 'bg-white text-[#141A15] shadow-xs'
                : 'text-[#4B554D] hover:text-[#141A15]'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <section className="lg:col-span-6 space-y-6">
          <p className="text-xs font-medium text-emerald-800 tracking-wide">
            {isHi
              ? 'स्मार्ट इंडिया हैकाथॉन 2026 · पोस्ट-हार्वेस्ट इंटेलिजेंस'
              : 'Smart India Hackathon 2026 · Post-Harvest Decision Intelligence'}
          </p>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-[#141A15] leading-tight text-balance">
            {isHi
              ? 'कटाई के बाद हर बैच के लिए सटीक निर्णय — बेचें, भंडारण करें या पूल करें।'
              : 'Turn every harvested batch into an auditable Sell, Store, Process, or Redirect decision.'}
          </h1>
          <p className="text-base text-[#4B554D] leading-relaxed max-w-xl">
            {isHi
              ? 'लाइव डिजिटल ट्विन गुणवत्ता अनुमान, Agmarknet/eNAM मंडी भाव, और किसान क्लस्टर परिवहन बचत को एक साथ जोड़ें।'
              : 'Combines live crop digital twins (Q10 shelf-life & spoilage curves), Agmarknet & eNAM mandi price feeds, and FPO cluster transport pooling with bilingual AI explanations.'}
          </p>

          <div className="pt-4 border-t border-[#E2E6DF] space-y-3">
            <h2 className="font-display text-sm font-semibold text-[#141A15]">
              {isHi ? 'तुरंत डेमो भूमिका चुनें (एक-क्लिक प्रवेश)' : 'Quick Role Evaluation Access'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('farmer')}
                className="text-left px-4 py-3 bg-white border border-[#E2E6DF] rounded-lg hover:border-emerald-700 transition-colors"
              >
                <div className="text-sm font-semibold text-[#141A15]">
                  {isHi ? 'किसान (Ramesh Patil)' : 'Farmer · Ramesh Patil'}
                </div>
                <div className="text-xs text-[#647066] mt-0.5">
                  Nashik · Batches, Digital Twin, AI Assist
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('fpo_admin')}
                className="text-left px-4 py-3 bg-white border border-[#E2E6DF] rounded-lg hover:border-emerald-700 transition-colors"
              >
                <div className="text-sm font-semibold text-[#141A15]">
                  {isHi ? 'FPO व्यवस्थापक (Vikram)' : 'FPO Admin · Vikram Kulkarni'}
                </div>
                <div className="text-xs text-[#647066] mt-0.5">
                  Cluster Pooling, Approvals, Reports
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('buyer')}
                className="text-left px-4 py-3 bg-white border border-[#E2E6DF] rounded-lg hover:border-emerald-700 transition-colors"
              >
                <div className="text-sm font-semibold text-[#141A15]">
                  {isHi ? 'खरीदार / प्रोसेसर' : 'Buyer / Processor · FreshBasket'}
                </div>
                <div className="text-xs text-[#647066] mt-0.5">
                  Pooled Lot Procurement & Mandi View
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin('system_admin')}
                className="text-left px-4 py-3 bg-white border border-[#E2E6DF] rounded-lg hover:border-emerald-700 transition-colors"
              >
                <div className="text-sm font-semibold text-[#141A15]">
                  {isHi ? 'सिस्टम एडमिन' : 'System Admin · Dr. Kavita Rao'}
                </div>
                <div className="text-xs text-[#647066] mt-0.5">
                  Crop Constants, Feeds & User RBAC
                </div>
              </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 bg-white border border-[#E2E6DF] rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-2 border-b border-[#E2E6DF] pb-4 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:bg-[#F1F3EF]'
              }`}
            >
              {isHi ? 'साइन इन' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'register'
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:bg-[#F1F3EF]'
              }`}
            >
              {isHi ? 'नया पंजीकरण' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('recover');
                setError(null);
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === 'recover'
                  ? 'bg-emerald-700 text-white'
                  : 'text-[#4B554D] hover:bg-[#F1F3EF]'
              }`}
            >
              {isHi ? 'खाता रिकवरी' : 'Forgot / OTP Recovery'}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg"
            >
              {error}
            </div>
          )}

          {info && (
            <div className="mb-4 px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg space-y-1">
              <div>{info}</div>
              {devOtpPreview && (
                <div className="font-mono text-xs text-emerald-800">
                  Test OTP Code: <strong>{devOtpPreview}</strong>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="flex gap-2 p-1 bg-[#F7F8F6] border border-[#E2E6DF] rounded-lg">
                <button
                  type="button"
                  onClick={() => setAuthMethod('otp')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
                    authMethod === 'otp'
                      ? 'bg-white text-[#141A15] shadow-xs'
                      : 'text-[#4B554D]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  {isHi ? 'मोबाइल + OTP (किसान)' : 'Mobile + OTP (Farmer)'}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('password')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
                    authMethod === 'password'
                      ? 'bg-white text-[#141A15] shadow-xs'
                      : 'text-[#4B554D]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  {isHi ? 'ईमेल + पासवर्ड (FPO/खरीदार)' : 'Email + Password (FPO / Buyer)'}
                </button>
              </div>

              {authMethod === 'otp' ? (
                <>
                  <div>
                    <label
                      htmlFor="login-phone"
                      className="block text-sm font-medium text-[#141A15] mb-1.5"
                    >
                      {isHi ? '10-अंकीय मोबाइल नंबर' : '10-Digit Mobile Number'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="login-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9822011223"
                        className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleRequestOtp}
                        className="px-4 py-2.5 text-xs font-semibold bg-[#F1F3EF] text-[#141A15] border border-[#D4D9D0] rounded-lg hover:bg-[#E7EBE4] whitespace-nowrap shrink-0"
                      >
                        {otpSent ? (isHi ? 'पुनः भेजें' : 'Resend OTP') : isHi ? 'OTP भेजें' : 'Send OTP'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-otp"
                      className="block text-sm font-medium text-[#141A15] mb-1.5"
                    >
                      {isHi ? '6-अंकीय OTP दर्ज करें' : '6-Digit OTP'}
                    </label>
                    <input
                      id="login-otp"
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-sm font-medium text-[#141A15] mb-1.5"
                    >
                      {isHi ? 'ईमेल पता' : 'Email Address'}
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-sm font-medium text-[#141A15] mb-1.5"
                    >
                      {isHi ? 'पासवर्ड' : 'Password'}
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {loading
                  ? isHi
                    ? 'प्रतीक्षा करें...'
                    : 'Signing in...'
                  : isHi
                  ? 'एग्रीनेक्सस में प्रवेश करें'
                  : 'Sign In to AgriNexus'}
              </button>

              <p className="text-xs text-[#647066] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                {isHi
                  ? '5 गलत प्रयासों के बाद खाता 15 मिनट के लिए लॉक हो जाता है। सत्र ऑफ़लाइन उपयोग के लिए सुरक्षित रहता है।'
                  : 'Accounts lock for 15 minutes after 5 consecutive failed attempts. Sessions persist for offline field sync.'}
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-role" className="block text-sm font-medium text-[#141A15] mb-1">
                  {isHi ? 'आपकी भूमिका चुनें' : 'Select Account Role'}
                </label>
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <option value="farmer">{isHi ? 'किसान (Farmer)' : 'Farmer'}</option>
                  <option value="fpo_admin">{isHi ? 'FPO व्यवस्थापक (FPO Admin)' : 'FPO Administrator'}</option>
                  <option value="buyer">{isHi ? 'खरीदार / प्रोसेसर (Buyer / Processor)' : 'Buyer / Processor'}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-[#141A15] mb-1">
                    {isHi ? 'पूरा नाम' : 'Full Name'}
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kiran More"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="reg-locality" className="block text-sm font-medium text-[#141A15] mb-1">
                    {isHi ? 'गाँव / शहर' : 'Village / Locality'}
                  </label>
                  <input
                    id="reg-locality"
                    type="text"
                    required
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="Nashik"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg"
                  />
                </div>
              </div>

              {role === 'farmer' ? (
                <div>
                  <label htmlFor="reg-phone" className="block text-sm font-medium text-[#141A15] mb-1">
                    {isHi ? 'मोबाइल नंबर' : 'Mobile Number'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#F1F3EF] border border-[#D4D9D0] rounded-lg"
                    >
                      Send OTP
                    </button>
                  </div>
                  <input
                    aria-label="Registration OTP"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP (optional if skipping SMS in demo)"
                    className="mt-2 w-full px-3.5 py-2 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-email" className="block text-sm font-medium text-[#141A15] mb-1">
                      Email
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-pass" className="block text-sm font-medium text-[#141A15] mb-1">
                      Password
                    </label>
                    <input
                      id="reg-pass"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
              >
                {loading ? 'Creating Account...' : isHi ? 'पंजीकरण पूरा करें' : 'Register & Continue'}
              </button>
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={handleRecoverSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#4B554D]">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                <span>
                  {isHi
                    ? 'OTP के माध्यम से अपना खाता अनलॉक या पासवर्ड रीसेट करें।'
                    : 'Recover access or reset password via 5-minute single-use mobile OTP.'}
                </span>
              </div>
              <div>
                <label htmlFor="rec-phone" className="block text-sm font-medium text-[#141A15] mb-1">
                  Registered Mobile Number
                </label>
                <div className="flex gap-2">
                  <input
                    id="rec-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    className="px-4 py-2 text-xs font-semibold bg-[#F1F3EF] border border-[#D4D9D0] rounded-lg"
                  >
                    Send OTP
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="rec-otp" className="block text-sm font-medium text-[#141A15] mb-1">
                  OTP Code
                </label>
                <input
                  id="rec-otp"
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-[#D4D9D0] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="rec-pass" className="block text-sm font-medium text-[#141A15] mb-1">
                  New Password (optional for OTP-only farmers)
                </label>
                <input
                  id="rec-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D4D9D0] rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-700 text-white text-sm font-semibold rounded-lg hover:bg-emerald-800 transition-colors"
              >
                {loading ? 'Recovering...' : 'Verify OTP & Restore Access'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};
