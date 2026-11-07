import React, { useState, useEffect } from 'react';
import axios from '../services/api';
import { getPasswordStrength } from '../utils/password';
import {
  ShieldCheck, Mail, KeyRound, Lock, ArrowRight, ArrowLeft,
  RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldAlert, User
} from 'lucide-react';

const inputCls =
  'w-full pl-11 pr-4 py-3 bg-pink-50/30 border border-pink-100 rounded-2xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-300 text-xs font-medium text-slate-700 transition';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, icon: Icon, children }) {
  return (
    <div className="animate-modal-pop">
      <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-3.5 text-pink-300" size={18} />
        {children}
      </div>
    </div>
  );
}

function PasswordField({ label, icon, value, onChange, placeholder = '••••••••', autoComplete, onCaps }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} icon={icon}>
      <input
        type={show ? 'text' : 'password'}
        required
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={(e) => onCaps && onCaps(e.getModifierState && e.getModifierState('CapsLock'))}
        className={`${inputCls} !pr-11`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
        title={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </Field>
  );
}

function StrengthBar({ password }) {
  if (!password) return null;
  const s = getPasswordStrength(password);
  return (
    <div className="-mt-1 space-y-1 px-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-slate-400">ระดับความปลอดภัย</span>
        <span className={s.textColor}>{s.text}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 ${s.color}`} style={{ width: `${s.score}%` }} />
      </div>
    </div>
  );
}

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const switchMode = (toLogin) => {
    setError('');
    setPassword('');
    setConfirmPassword('');
    setMasterPassword('');
    setCapsOn(false);
    setIsLogin(toLogin);
  };

  const validateRegister = () => {
    if (!name.trim()) return 'กรุณากรอกชื่อผู้ใช้งาน';
    if (password.length < 8) return 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษรขึ้นไป';
    if (password !== confirmPassword) return 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง';
    if (masterPassword.length < 8) return 'Master Password ต้องมีความยาวอย่างน้อย 8 ตัวอักษร';
    if (masterPassword === password) return 'Master Password ควรต่างจากรหัสผ่านเข้าสู่ระบบ';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    if (!isLogin) {
      const msg = validateRegister();
      if (msg) { setError(msg); return; }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await axios.post('/auth/login', { email: cleanEmail, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('email', res.data.email);

        if (rememberMe) localStorage.setItem('saved_email', cleanEmail);
        else localStorage.removeItem('saved_email');

        setSuccessToast('เข้าสู่ระบบสำเร็จ กำลังเปิดตู้เซฟ...');
        setTimeout(onLoginSuccess, 1000);
      } else {
        await axios.post('/auth/register', { name: name.trim(), email: cleanEmail, password, masterPassword });
        setSuccessToast('สมัครสมาชิกตู้เซฟสำเร็จ สามารถเข้าสู่ระบบได้ทันที');
        setTimeout(() => {
          setSuccessToast(null);
          switchMode(true);
          setEmail(cleanEmail);
        }, 1500);
      }
    } catch (err) {
      const status = err.response?.status;
      setError(
        err.response?.data?.error ||
        (status === 401 ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' :
         status === 429 ? 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' :
         !err.response ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' :
         'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50/40 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-pink-200/50 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl animate-pulse"></div>

      {successToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-white border border-pink-200 text-slate-800 px-6 py-3.5 rounded-2xl shadow-xl shadow-pink-100 flex items-center gap-3 z-50 animate-modal-pop max-w-[90vw]">
          <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      <div className="max-w-md w-full bg-white border border-pink-100 rounded-3xl p-8 relative z-10 shadow-xl shadow-pink-100/50 animate-modal-pop">
        <div className="relative mb-6">
          {!isLogin && (
            <button
              type="button"
              onClick={() => switchMode(true)}
              className="absolute left-0 top-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-pink-50 rounded-xl transition cursor-pointer"
              title="ย้อนกลับไปหน้าเข้าสู่ระบบ"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="text-center select-none">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 text-white rounded-3xl mb-3 shadow-lg shadow-pink-200 transition-transform duration-300 hover:scale-105">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">SweetVault</h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              {isLogin ? 'ระบบจัดเก็บรหัสผ่านความปลอดภัยสูง' : 'ลงทะเบียนสร้างบัญชีตู้เซฟใหม่'}
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-5 p-3.5 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-xs font-bold flex items-center gap-2 animate-modal-pop">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!isLogin && (
            <Field label="ชื่อผู้ใช้งาน (Display Name)" icon={User}>
              <input
                type="text" required value={name} autoComplete="name" maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อของคุณ" className={inputCls}
              />
            </Field>
          )}

          <Field label="อีเมลผู้ใช้" icon={Mail}>
            <input
              type="email" required value={email} autoComplete="email" autoFocus={isLogin}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@sweetvault.com" className={inputCls}
            />
          </Field>

          <PasswordField
            label="รหัสผ่าน" icon={KeyRound} value={password} onChange={setPassword}
            autoComplete={isLogin ? 'current-password' : 'new-password'} onCaps={setCapsOn}
          />
          {!isLogin && <StrengthBar password={password} />}

          {!isLogin && (
            <PasswordField
              label="ยืนยันรหัสผ่าน" icon={KeyRound} value={confirmPassword}
              onChange={setConfirmPassword} autoComplete="new-password" onCaps={setCapsOn}
            />
          )}
          {!isLogin && confirmPassword && (
            <p className={`-mt-2 px-1 text-[10px] font-bold ${password === confirmPassword ? 'text-emerald-500' : 'text-rose-500'}`}>
              {password === confirmPassword ? 'รหัสผ่านตรงกัน' : 'รหัสผ่านยังไม่ตรงกัน'}
            </p>
          )}

          {!isLogin && (
            <>
              <PasswordField
                label="Master Password (รหัสหลักตู้เซฟ)" icon={Lock} value={masterPassword}
                onChange={setMasterPassword} autoComplete="off"
                placeholder="รหัสลับหลักสำหรับถอดรหัสเซฟ" onCaps={setCapsOn}
              />
              <StrengthBar password={masterPassword} />
              <p className="px-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl py-2 flex gap-1.5">
                <AlertCircle size={13} className="shrink-0 mt-px" />
                <span>จดรหัสหลักไว้ในที่ปลอดภัย หากลืมอาจกู้ข้อมูลในตู้เซฟไม่ได้</span>
              </p>
            </>
          )}

          {capsOn && (
            <p className="px-1 text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
              <AlertCircle size={13} /> Caps Lock เปิดอยู่
            </p>
          )}

          {isLogin && (
            <div className="flex items-center justify-between px-1 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox" checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-lg accent-pink-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-500">จดจำอีเมลของฉัน</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md shadow-pink-200 transition-all duration-200 text-xs mt-3 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <><RefreshCw size={16} className="animate-spin" /> กำลังประมวลผล...</>
            ) : (
              <>{isLogin ? 'เปิดตู้เซฟเข้าสู่ระบบ' : 'ลงทะเบียนสร้างตู้เซฟ'}<ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="mt-6 p-3 bg-pink-50/50 rounded-2xl border border-pink-100/60 flex items-center gap-2.5 text-[11px] text-slate-500 select-none">
          <ShieldAlert size={16} className="text-pink-500 shrink-0" />
          <span>ล็อกอัตโนมัติเมื่อไม่ใช้งาน และล้างคลิปบอร์ดหลังคัดลอกรหัสผ่าน</span>
        </div>

        <div className="text-center mt-5 border-t border-pink-50 pt-4">
          <button
            type="button"
            onClick={() => switchMode(!isLogin)}
            className="text-xs text-pink-500 hover:text-pink-600 font-bold transition hover:underline cursor-pointer"
          >
            {isLogin ? 'ยังไม่มีตู้เซฟ? ลงทะเบียนใช้งานใหม่ที่นี่' : 'มีบัญชีตู้เซฟอยู่แล้ว? เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    </div>
  );
}
