import React, { useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../services/api';
import { Sparkles, MessageSquare, Clock, ArrowRight, Check, Building, ShieldCheck } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: (user: UserProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'welcome' | 'form' | 'how_it_works'>('welcome');

  // Form fields
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [name, setName] = useState('');
  const [businessType, setBusinessType] = useState('Interior Design');
  const [languagePreference, setLanguagePreference] = useState<'en' | 'hi' | 'hinglish'>('hinglish');
  const [reminderTime, setReminderTime] = useState('10:00');
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLoginMode) {
        const { user } = await api.login(email);
        onComplete(user);
      } else {
        const { user } = await api.signup({
          email,
          businessName,
          name: name || businessName,
          businessType,
          languagePreference,
          reminderTime,
          timeZone: 'Asia/Kolkata',
        });
        setStep('how_it_works');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    const user = await api.getCurrentUser();
    onComplete(user);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {step === 'welcome' && (
          <div className="p-5 text-center space-y-4">
            <div className="w-13 h-13 rounded-2xl bg-[#087F68] text-white flex items-center justify-center mx-auto shadow-xs text-xl font-black">
              QB
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F68]">
                Sales Assistant for Interior Designers
              </span>
              <h2 className="text-xl font-black text-[#18211F] dark:text-white tracking-tight mt-0.5">
                QuoteBack AI
              </h2>
              <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] mt-1.5 max-w-xs mx-auto leading-relaxed">
                Never lose track of a quotation because you forgot to follow up. Track quotes, get daily reminders, and generate WhatsApp follow-ups in seconds.
              </p>
            </div>

            <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/60 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] text-left text-xs space-y-1.5">
              <div className="flex items-center space-x-2 text-[#18211F] dark:text-[#EAEFEA]">
                <Check className="w-3.5 h-3.5 text-[#087F68] shrink-0" />
                <span>Store customer enquiries from WhatsApp & Instagram</span>
              </div>
              <div className="flex items-center space-x-2 text-[#18211F] dark:text-[#EAEFEA]">
                <Check className="w-3.5 h-3.5 text-[#087F68] shrink-0" />
                <span>Generate personalized follow-ups in English, Hindi & Hinglish</span>
              </div>
              <div className="flex items-center space-x-2 text-[#18211F] dark:text-[#EAEFEA]">
                <Check className="w-3.5 h-3.5 text-[#087F68] shrink-0" />
                <span>One-tap WhatsApp opening with prefilled message</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setIsLoginMode(false);
                  setStep('form');
                }}
                className="w-full py-2.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs transition active:scale-95"
              >
                Create Account (Free Starter)
              </button>

              <button
                onClick={() => {
                  setIsLoginMode(true);
                  setStep('form');
                }}
                className="w-full py-2 rounded-xl bg-[#F2F4F2] dark:bg-[#202A27] text-[#18211F] dark:text-[#EAEFEA] font-semibold text-xs hover:bg-[#E8EBE8] transition"
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>
        )}

        {step === 'form' && (
          <div className="p-5 overflow-y-auto space-y-3.5">
            <div>
              <h3 className="text-base font-bold text-[#18211F] dark:text-white">
                {isLoginMode ? 'Welcome Back' : 'Set Up Your Design Studio'}
              </h3>
              <p className="text-xs text-[#6B7470] mt-0.5">
                {isLoginMode ? 'Sign in to access your quotations & pipeline.' : 'Just a few details to personalize your follow-ups.'}
              </p>
            </div>

            {error && (
              <div className="p-2.5 bg-[#FDF2F3] border border-[#F7D2D6] rounded-xl text-[#C83C4B] text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-2.5 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Email Address <span className="text-[#C83C4B]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. contact@sharmainteriors.in"
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                />
              </div>

              {!isLoginMode && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                      Business / Brand Name <span className="text-[#C83C4B]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="e.g. Sharma Luxury Interiors"
                      className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                      Business Type
                    </label>
                    <select
                      value={businessType}
                      onChange={e => setBusinessType(e.target.value)}
                      className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                    >
                      <option value="Interior Design">Interior Design Studio</option>
                      <option value="Modular Kitchen">Modular Kitchen & Wardrobes</option>
                      <option value="Turnkey Fitout">Turnkey Fitouts</option>
                      <option value="Architecture Studio">Architectural Firm</option>
                      <option value="Custom Furniture">Custom Furniture</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                      Preferred AI Message Language
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#F2F4F2] dark:bg-[#202A27] p-0.5 rounded-xl">
                      {[
                        { id: 'hinglish', label: 'Hinglish' },
                        { id: 'en', label: 'English' },
                        { id: 'hi', label: 'Hindi' },
                      ].map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLanguagePreference(l.id as any)}
                          className={`py-1 text-xs font-semibold rounded-lg transition ${
                            languagePreference === l.id
                              ? 'bg-white dark:bg-[#18211F] text-[#087F68] shadow-xs'
                              : 'text-[#6B7470]'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs transition active:scale-95"
                >
                  {loading ? 'Please wait...' : isLoginMode ? 'Sign In' : 'Complete Setup & Open App'}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  className="text-xs text-[#087F68] font-semibold hover:underline"
                >
                  {isLoginMode ? "Need an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'how_it_works' && (
          <div className="p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5EF] text-[#087F68] flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-[#18211F] dark:text-white">
                You&apos;re All Set, {name || businessName}!
              </h3>
              <p className="text-xs text-[#6B7470] mt-0.5 max-w-xs mx-auto">
                Here is how QuoteBack AI saves deals:
              </p>
            </div>

            <div className="space-y-2 text-left text-xs">
              <div className="p-2.5 rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-md bg-[#087F68] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-bold text-[#18211F] dark:text-white">Capture Quotes & Leads</div>
                  <div className="text-[#6B7470] text-[10px] mt-0.5">Store customer details and quotation amounts in seconds.</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-md bg-[#087F68] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-bold text-[#18211F] dark:text-white">Never Forget Follow-Ups</div>
                  <div className="text-[#6B7470] text-[10px] mt-0.5">Surfaces who needs follow-up today and flags overdue quotes.</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] flex items-start space-x-2.5">
                <div className="w-5 h-5 rounded-md bg-[#087F68] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="font-bold text-[#18211F] dark:text-white">1-Tap WhatsApp AI Messages</div>
                  <div className="text-[#6B7470] text-[10px] mt-0.5">Personalized messages in Hinglish/English ready to send directly.</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleFinishOnboarding}
              className="w-full py-2.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs active:scale-95 transition"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
