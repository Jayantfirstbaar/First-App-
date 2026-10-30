import React, { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, User as UserIcon, Eye, EyeOff, ArrowRight, Github, Chrome, AlertCircle, RefreshCw, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

export const AuthView: React.FC = () => {
  const { loginAsDemoUser, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gcpApiDisabled, setGcpApiDisabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const syncUserProfile = async (user: User, name?: string) => {
    const profile = {
      id: user.uid,
      email: user.email || '',
      name: name || user.displayName || email.split('@')[0],
      businessName: name || user.displayName || email.split('@')[0] + "'s Business",
      businessType: 'Interior Design',
      languagePreference: 'hinglish' as const,
      timeZone: 'Asia/Kolkata',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore for redundancy/persistence
    await setDoc(doc(db, 'users', user.uid), profile, { merge: true });

    // Sync with backend API
    try {
      const idToken = await user.getIdToken();
      api.setToken(idToken);
      await api.signup(profile).catch(async () => {
        // If already exists, just update
        await api.updateProfile(profile);
      });
    } catch (err) {
      console.error('Failed to sync profile with backend:', err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        await syncUserProfile(userCredential.user, fullName);
        setVerificationSent(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken();
        api.setToken(idToken);
        if (!userCredential.user.emailVerified) {
          setVerificationSent(true);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('token-service-api-has-not-been-used') || err.message.includes('securetoken.googleapis.com'))) {
        setGcpApiDisabled(true);
        setError('Firebase Token Service API is currently disabled or initializing for project 371309433233.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user);
      const idToken = await result.user.getIdToken();
      api.setToken(idToken);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked. Please allow popups for this site.');
      } else if (err.message && (err.message.includes('token-service-api-has-not-been-used') || err.message.includes('securetoken.googleapis.com'))) {
        setGcpApiDisabled(true);
        setError('Firebase Token Service API is disabled or initializing for project 371309433233.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Password reset email sent! Check your inbox.');
      setIsForgotPassword(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (currentUser && resendCooldown === 0) {
      try {
        await sendEmailVerification(currentUser);
        setResendCooldown(60);
        setSuccessMessage('Verification email resent!');
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleRefreshStatus = async () => {
    if (currentUser) {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        window.location.reload();
      } else {
        setError('Email still not verified. Please check your inbox.');
      }
    }
  };

  if (verificationSent || (currentUser && !currentUser.emailVerified)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFCFB] p-4 font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-[32px] shadow-2xl border border-[#E6EAE7] space-y-6 text-center">
          <div className="w-16 h-16 bg-[#E8F5EF] text-[#087F68] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-bold text-[#18211F]">Verify your email</h2>
          <p className="text-[#6B7470] text-sm leading-relaxed">
            We&apos;ve sent a verification link to <span className="font-bold text-[#18211F]">{currentUser?.email || email}</span>. 
            Please click the link in the email to activate your QuoteBack AI account.
          </p>

          <div className="space-y-3 pt-4">
            <button
              onClick={handleRefreshStatus}
              className="w-full py-3.5 bg-[#087F68] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#087F68]/20 flex items-center justify-center space-x-2 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>I&apos;ve verified my email</span>
            </button>
            
            <button
              onClick={handleResendVerification}
              disabled={resendCooldown > 0}
              className="w-full py-3.5 bg-white text-[#18211F] border border-[#E6EAE7] rounded-2xl font-bold text-sm hover:bg-[#F7F8F6] transition disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
            </button>
          </div>

          <button
            onClick={() => auth.signOut()}
            className="text-xs text-[#6B7470] hover:text-[#18211F] underline pt-4"
          >
            Back to Sign In
          </button>
          
          {error && (
            <div className="p-3 bg-[#FDF2F3] border border-[#F7D2D6] rounded-xl text-[#C83C4B] text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-[#E8F5EF] border border-[#CBE7DC] rounded-xl text-[#087F68] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFCFB] p-4 font-sans">
      <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border border-[#E6EAE7] relative overflow-hidden">
        {/* Brand Mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-[#087F68] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-[#087F68]/20">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-[#18211F] tracking-tight">QuoteBack AI</h1>
          <p className="text-[#6B7470] text-sm mt-1 font-medium">
            {isForgotPassword ? 'Reset your password' : isRegister ? 'Create your free account' : 'Welcome back'}
          </p>
        </div>

        {/* GCP Token Service API Banner */}
        {(gcpApiDisabled || (authError && authError.includes('token-service-api-has-not-been-used'))) && (
          <div className="mb-6 p-4 bg-[#FEF9EE] border border-[#FDE6B8] rounded-2xl text-xs space-y-2">
            <div className="flex items-center space-x-2 text-[#92400E] font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Firebase Token Service API Initializing</span>
            </div>
            <p className="text-[#B45309] leading-relaxed">
              Google Cloud Secure Token API is disabled or initializing for project <code className="bg-[#FDE6B8] px-1 py-0.5 rounded font-mono">371309433233</code>.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href="https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=371309433233"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl font-bold text-center transition"
              >
                Enable Secure Token API in GCP ↗
              </a>
              <button
                type="button"
                onClick={() => loginAsDemoUser(email || 'sharma.interiors@example.com', fullName || 'Rajesh Sharma')}
                className="px-3 py-2 bg-[#087F68] hover:bg-[#066956] text-white rounded-xl font-bold text-center transition flex items-center justify-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Continue in Instant Preview Mode</span>
              </button>
            </div>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
              <input
                type="email"
                placeholder="Email address"
                required
                className="w-full pl-11 pr-4 py-3.5 bg-[#F7F8F6] border border-[#E6EAE7] rounded-2xl text-sm focus:ring-2 focus:ring-[#087F68] outline-none transition"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#087F68] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#087F68]/20 hover:bg-[#066956] transition active:scale-95 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="w-full text-sm font-bold text-[#6B7470] hover:text-[#18211F]"
            >
              Back to Login
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2.5">
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-3.5 bg-white border border-[#E6EAE7] rounded-2xl font-bold text-sm text-[#18211F] flex items-center justify-center space-x-3 hover:bg-[#F7F8F6] transition active:scale-95 disabled:opacity-50"
              >
                <Chrome className="w-5 h-5 text-[#4285F4]" />
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => loginAsDemoUser(email || 'sharma.interiors@example.com', fullName || 'Rajesh Sharma')}
                className="w-full py-2.5 bg-[#E8F5EF] hover:bg-[#D5EFE3] border border-[#CBE7DC] text-[#087F68] rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Quick Sign-In (Instant Preview)</span>
              </button>
            </div>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-[#E6EAE7]"></div>
              <span className="flex-shrink mx-4 text-[10px] uppercase font-black text-[#9BA5A0] tracking-widest">or continue with email</span>
              <div className="flex-grow border-t border-[#E6EAE7]"></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <div className="relative animate-in fade-in slide-in-from-top-2">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-[#F7F8F6] border border-[#E6EAE7] rounded-2xl text-sm focus:ring-2 focus:ring-[#087F68] outline-none transition"
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
                <input
                  type="email"
                  placeholder="Email address"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-[#F7F8F6] border border-[#E6EAE7] rounded-2xl text-sm focus:ring-2 focus:ring-[#087F68] outline-none transition"
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  className="w-full pl-11 pr-12 py-3.5 bg-[#F7F8F6] border border-[#E6EAE7] rounded-2xl text-sm focus:ring-2 focus:ring-[#087F68] outline-none transition"
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7470] hover:text-[#18211F]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {isRegister && (
                <div className="relative animate-in fade-in slide-in-from-top-2">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-[#F7F8F6] border border-[#E6EAE7] rounded-2xl text-sm focus:ring-2 focus:ring-[#087F68] outline-none transition"
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              {!isRegister && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-xs font-bold text-[#087F68] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#087F68] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#087F68]/20 hover:bg-[#066956] transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-6">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-sm text-[#6B7470]"
              >
                {isRegister ? 'Already have an account?' : 'New to QuoteBack?'}{' '}
                <span className="text-[#087F68] font-bold hover:underline">
                  {isRegister ? 'Sign in' : 'Create account'}
                </span>
              </button>
            </div>

            <div className="pt-6 border-t border-[#F2F4F2] text-center">
              <p className="text-[10px] text-[#9BA5A0] leading-relaxed">
                By continuing, you agree to QuoteBack AI&apos;s <br />
                <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-[#FDF2F3] border border-[#F7D2D6] rounded-xl text-[#C83C4B] text-xs flex items-center space-x-2 animate-in shake duration-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-3 bg-[#E8F5EF] border border-[#CBE7DC] rounded-xl text-[#087F68] text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
