import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from '../services/api';
import { getPasswordStrength, parseCsv, buildCsv } from '../utils/password';
import {
  ShieldCheck, LayoutGrid, Key, FileText, Bookmark, Download, Upload, Tag, Search, Plus, Bell,
  X, Check, Copy, Trash2, Eye, EyeOff, Edit, CheckCircle2, LogOut, Star, Sparkles,
  Gamepad2, Share2, AlertCircle, Lock, RefreshCw, Clock, User, Mail, ChevronDown
} from 'lucide-react';

// ---------- ตั้งค่า ----------
const AUTO_LOCK_MINUTES = 10;        // ไม่มีการใช้งานกี่นาทีถึงล็อกอัตโนมัติ
const LOCK_WARN_SECONDS = 60;        // เตือนก่อนล็อกกี่วินาที
const CLIPBOARD_CLEAR_SECONDS = 30;  // ล้างคลิปบอร์ดหลังคัดลอกรหัสผ่านกี่วินาที

const EMPTY_FORM = {
  title: '', username: '', password: '', category: 'Logins',
  imageUrl: '', notes: '', isFavorite: false, isImported: false, tag: 'Starter Kit'
};

const MAIN_MENU = [
  { key: 'All Items', icon: LayoutGrid },
  { key: 'Favorites', icon: Bookmark },
  { key: 'Watchtower', icon: ShieldCheck },
  { key: 'Imported', icon: Download },
];

const CATEGORIES = [
  { key: 'Logins', icon: Key, badge: 'bg-pink-50 text-pink-600' },
  { key: 'Identities', icon: FileText, badge: 'bg-purple-50 text-purple-600' },
  { key: 'Games', icon: Gamepad2, badge: 'bg-sky-50 text-sky-600' },
  { key: 'Social', icon: Share2, badge: 'bg-amber-50 text-amber-600' },
];

const AVATAR_GRADIENTS = [
  'from-pink-400 to-rose-500', 'from-fuchsia-400 to-pink-500', 'from-rose-400 to-orange-400',
  'from-purple-400 to-pink-400', 'from-pink-300 to-fuchsia-500',
];

const inputCls =
  'w-full px-4 py-3 bg-pink-50/30 border border-pink-100 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-300 transition';

// ---------- ฟังก์ชันช่วย ----------
const normalizeUrl = (u) => {
  const v = (u || '').trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const hashStr = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

// ---------- จัดหมวดหมู่อัตโนมัติจากชื่อบริการ ----------
// ลำดับสำคัญ: เจอกฎแรกที่ตรงก็ใช้เลย  (เพิ่ม/แก้คำได้ตามต้องการ)
const CATEGORY_RULES = [
  { category: 'Identities', words: [
    'passport', 'id card', 'national id', 'driver license', 'driving license', 'license', 'ssn', 'tax id',
    'พาสปอร์ต', 'หนังสือเดินทาง', 'บัตรประชาชน', 'ใบขับขี่', 'เลขประจำตัว', 'ประกันสังคม', 'ทะเบียนบ้าน', 'ภาษี',
  ] },
  { category: 'Games', words: [
    'steam', 'epic games', 'epicgames', 'riot', 'valorant', 'league of legends', 'roblox', 'minecraft',
    'playstation', 'psn', 'xbox', 'nintendo', 'garena', 'ea', 'origin', 'ubisoft', 'uplay', 'battle.net',
    'blizzard', 'genshin', 'hoyoverse', 'mihoyo', 'fortnite', 'pubg', 'free fire', 'rov', 'mobile legends',
    'gog', 'itch.io', 'game', 'เกม',
  ] },
  { category: 'Social', words: [
    'facebook', 'fb', 'instagram', 'ig', 'twitter', 'x', 'x.com', 'tiktok', 'line', 'discord', 'telegram',
    'whatsapp', 'messenger', 'snapchat', 'pinterest', 'reddit', 'linkedin', 'youtube', 'threads', 'wechat',
    'bluesky', 'tumblr', 'mastodon', 'twitch',
    'เฟซบุ๊ก', 'เฟซบุค', 'ไลน์', 'อินสตาแกรม', 'ติ๊กต็อก', 'ทวิตเตอร์', 'ยูทูป',
  ] },
];

const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// คำภาษาอังกฤษต้องตรงทั้งคำ (กัน "ea" ไปติดใน "Spotify") ส่วนคำไทยใช้ค้นหาแบบมีอยู่ในข้อความ
const RULE_MATCHERS = CATEGORY_RULES.map(({ category, words }) => ({
  category,
  re: new RegExp(
    words.map((w) => (/[a-z0-9]/.test(w) ? `(?:^|[^a-z0-9])${escapeRe(w)}(?:$|[^a-z0-9])` : escapeRe(w))).join('|'),
    'i'
  ),
}));

const guessCategory = (title) => {
  const t = (title || '').trim();
  if (!t) return null;
  const hit = RULE_MATCHERS.find(({ re }) => re.test(t));
  return hit ? hit.category : null;
};

function Logo({ item, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.imageUrl]);
  const box = size === 'lg' ? 'w-16 h-16 text-2xl rounded-xl' : size === 'sm' ? 'w-10 h-10 text-base rounded-lg' : 'w-12 h-12 text-xl rounded-xl';

  if (item.imageUrl && !broken) {
    return (
      <div className={`${box} bg-white border border-pink-100 flex items-center justify-center overflow-hidden p-1.5 shadow-xs shrink-0`}>
        <img src={item.imageUrl} alt={item.title} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" onError={() => setBroken(true)} />
      </div>
    );
  }
  const g = AVATAR_GRADIENTS[hashStr(item.title || '?') % AVATAR_GRADIENTS.length];
  return (
    <div className={`${box} bg-gradient-to-br ${g} text-white flex items-center justify-center font-black shadow-md shadow-pink-100 shrink-0`}>
      {(item.title || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition cursor-pointer ${
        active ? 'bg-pink-50 text-pink-600 font-semibold' : 'hover:bg-pink-50/50 text-slate-600'
      }`}
    >
      <span className="flex items-center gap-3 truncate"><Icon size={16} className="shrink-0" /> <span className="truncate">{label}</span></span>
      {count !== undefined && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${active ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-600'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function IconBtn({ title, onClick, danger, children }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      className={`p-2 rounded-lg transition cursor-pointer ${danger ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50' : 'text-slate-400 hover:text-pink-600 hover:bg-pink-50'}`}>
      {children}
    </button>
  );
}

function AccountAvatar({ email, size = 'md' }) {
  const box = size === 'lg' ? 'w-11 h-11 text-base' : size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm';
  const g = AVATAR_GRADIENTS[hashStr(email || '?') % AVATAR_GRADIENTS.length];
  return (
    <div className={`${box} rounded-full bg-gradient-to-br ${g} text-white flex items-center justify-center font-black shrink-0`}>
      {(email || '?').charAt(0).toUpperCase()}
    </div>
  );
}

const CSV_ALIASES = {
  title: ['title', 'name', 'service'],
  username: ['username', 'user', 'login', 'email'],
  password: ['password', 'pass'],
  category: ['category', 'type'],
  notes: ['notes', 'note'],
  tag: ['tag', 'folder'],
};

// ================= หน้าหลัก =================
export default function Dashboard({ onLogout }) {
  const [activeMenu, setActiveMenu] = useState('All Items');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' });
  const [showEmailPass, setShowEmailPass] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false); // ผู้ใช้เลือกหมวดเองแล้ว → ห้ามเขียนทับ
  const [autoCat, setAutoCat] = useState(false);                 // หมวดปัจจุบันมาจากการจัดอัตโนมัติ

  const [vaultItems, setVaultItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [lockWarning, setLockWarning] = useState(false);

  const toastTimer = useRef(null);
  const clipTimer = useRef(null);
  const copiedTimer = useRef(null);
  const searchRef = useRef(null);
  const fileRef = useRef(null);
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;

  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('email') || '');
  const userName = userEmail ? userEmail.split('@')[0] : 'เพื่อน';
  const [sessionStart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sv_session_start');
      if (saved) return new Date(Number(saved));
      const now = Date.now();
      sessionStorage.setItem('sv_session_start', String(now));
      return new Date(now);
    } catch {
      return new Date();
    }
  });
  const sessionStartText = sessionStart.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // ถ้า token หมดอายุ (401) ให้ออกจากระบบทันที
  const handleApiError = (err, fallbackMsg) => {
    if (err?.response?.status === 401) {
      logoutRef.current && logoutRef.current();
      return;
    }
    showToast(fallbackMsg + (err?.response?.data?.error ? `: ${err.response.data.error}` : ''), 'error');
  };

  const loadItems = async () => {
    setLoadingItems(true);
    setLoadError(false);
    try {
      const res = await axios.get('/vault');
      setVaultItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch vault items', err);
      setLoadError(true);
      handleApiError(err, 'โหลดข้อมูลจากตู้เซฟไม่สำเร็จ');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => { loadItems(); /* eslint-disable-next-line */ }, []);

  // ล้างตัวจับเวลาตอนออกจากหน้า + ล้างคลิปบอร์ดที่ค้าง
  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    clearTimeout(copiedTimer.current);
    if (clipTimer.current) {
      clearTimeout(clipTimer.current);
      navigator.clipboard?.writeText('').catch(() => {});
    }
  }, []);

  // ล็อกอัตโนมัติเมื่อไม่มีการใช้งาน + เตือนก่อนล็อก
  useEffect(() => {
    let lockT, warnT;
    const reset = () => {
      clearTimeout(lockT); clearTimeout(warnT);
      setLockWarning(false);
      const total = AUTO_LOCK_MINUTES * 60 * 1000;
      warnT = setTimeout(() => setLockWarning(true), total - LOCK_WARN_SECONDS * 1000);
      lockT = setTimeout(() => logoutRef.current && logoutRef.current(), total);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(lockT); clearTimeout(warnT);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);

  // ปุ่มลัด: Esc ปิดหน้าต่าง, Ctrl/Cmd+K โฟกัสช่องค้นหา
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false); setSelectedItemForView(null);
        setDeleteTarget(null); setIsLogoutModalOpen(false); setIsNotifOpen(false); setIsExportOpen(false); setIsProfileOpen(false); setIsEmailModalOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // ปิดรายละเอียดแล้วต้องซ่อนรหัสผ่านกลับ
  useEffect(() => {
    if (!selectedItemForView) setShowPasswordMap({});
  }, [selectedItemForView]);

  // ---------- วิเคราะห์ความปลอดภัย (Watchtower) ----------
  const passCount = useMemo(() => {
    const m = {};
    vaultItems.forEach((i) => { if (i.password) m[i.password] = (m[i.password] || 0) + 1; });
    return m;
  }, [vaultItems]);

  const isWeak = (i) => !!i.password && getPasswordStrength(i.password).score <= 33;
  const isReused = (i) => !!i.password && passCount[i.password] > 1;
  const isRisky = (i) => isWeak(i) || isReused(i);

  const stats = useMemo(() => {
    const total = vaultItems.length;
    const weak = vaultItems.filter(isWeak).length;
    const reused = vaultItems.filter(isReused).length;
    const risky = vaultItems.filter(isRisky).length;
    const fav = vaultItems.filter((i) => i.isFavorite).length;
    const score = total ? Math.round(((total - risky) / total) * 100) : 100;
    return { total, weak, reused, risky, fav, score };
    // eslint-disable-next-line
  }, [vaultItems, passCount]);

  const counts = useMemo(() => {
    const c = {
      'All Items': stats.total, Favorites: stats.fav, Watchtower: stats.risky,
      Imported: vaultItems.filter((i) => i.isImported).length,
    };
    CATEGORIES.forEach(({ key }) => { c[key] = vaultItems.filter((i) => i.category === key).length; });
    return c;
  }, [vaultItems, stats]);

  const tags = useMemo(() => {
    const t = [...new Set(vaultItems.map((i) => i.tag).filter(Boolean))];
    return t.length ? t : ['Starter Kit'];
  }, [vaultItems]);

  const notifications = [
    stats.weak > 0 && { id: 'weak', type: 'warn', title: `พบรหัสผ่านอ่อนแอ ${stats.weak} รายการ`, desc: 'ควรเปลี่ยนเป็นรหัสที่ยาวและซับซ้อนขึ้น' },
    stats.reused > 0 && { id: 'reused', type: 'warn', title: `พบรหัสผ่านซ้ำกัน ${stats.reused} รายการ`, desc: 'การใช้รหัสเดียวกันหลายที่เสี่ยงต่อการถูกเจาะ' },
    stats.risky === 0 && { id: 'ok', type: 'ok', title: 'ตู้เซฟของคุณปลอดภัยดี', desc: 'ไม่พบรหัสผ่านอ่อนแอหรือซ้ำกัน' },
  ].filter(Boolean);

  // ---------- Handlers ----------
  const handleOpenAddModal = () => {
    setEditingItem(null);
    const fromCategory = CATEGORIES.some((c) => c.key === activeMenu);
    setFormData({ ...EMPTY_FORM, category: fromCategory ? activeMenu : 'Logins' });
    setCategoryTouched(fromCategory);
    setAutoCat(false);
    setShowFormPassword(false);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item, e) => {
    if (e) e.stopPropagation();
    setEditingItem(item);
    setCategoryTouched(true);
    setAutoCat(false);
    setFormData({
      title: item.title || '', username: item.username || '', password: item.password || '',
      category: item.category || 'Logins', imageUrl: item.imageUrl || '', notes: item.notes || '',
      isFavorite: !!item.isFavorite, isImported: !!item.isImported, tag: item.tag || 'Starter Kit',
    });
    setShowFormPassword(false);
    setSelectedItemForView(null);
    setIsAddModalOpen(true);
  };

  // พิมพ์ชื่อบริการแล้วเดาหมวดหมู่ให้ (เฉพาะตอนที่ผู้ใช้ยังไม่ได้เลือกหมวดเอง)
  const handleTitleChange = (e) => {
    const title = e.target.value;
    if (categoryTouched) { setFormData({ ...formData, title }); return; }
    const guess = guessCategory(title);
    if (guess) {
      setFormData({ ...formData, title, category: guess });
      setAutoCat(true);
    } else {
      setFormData({ ...formData, title, ...(autoCat ? { category: 'Logins' } : {}) });
      setAutoCat(false);
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!formData.title.trim() || !formData.username.trim() || !formData.password) return;
    const payload = {
      ...formData,
      title: formData.title.trim(),
      username: formData.username.trim(),
      tag: (formData.tag || '').trim() || 'Starter Kit',
      imageUrl: normalizeUrl(formData.imageUrl),
    };

    setSaving(true);
    try {
      if (editingItem) {
        const res = await axios.put(`/vault/${editingItem.id}`, payload);
        setVaultItems((prev) => prev.map((i) => (i.id === editingItem.id ? res.data : i)));
        showToast('อัปเดตข้อมูลเรียบร้อย');
      } else {
        const res = await axios.post('/vault', payload);
        setVaultItems((prev) => [res.data, ...prev]);
        showToast('บันทึกรหัสผ่านลงตู้เซฟแล้ว');
      }
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Save failed:', err.response?.data || err);
      handleApiError(err, 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavorite = async (id, e) => {
    if (e) e.stopPropagation();
    const target = vaultItems.find((i) => i.id === id);
    if (!target) return;
    try {
      const res = await axios.put(`/vault/${id}`, { isFavorite: !target.isFavorite });
      setVaultItems((prev) => prev.map((i) => (i.id === id ? res.data : i)));
      setSelectedItemForView((cur) => (cur && cur.id === id ? res.data : cur));
    } catch (err) {
      console.error(err);
      handleApiError(err, 'เปลี่ยนสถานะรายการโปรดไม่สำเร็จ');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`/vault/${deleteTarget.id}`);
      setVaultItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setSelectedItemForView((cur) => (cur && cur.id === deleteTarget.id ? null : cur));
      showToast('ลบรายการแล้ว');
    } catch (err) {
      console.error(err);
      handleApiError(err, 'ไม่สามารถลบรายการได้');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleCopy = async (text, id, secret = false, e) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text || '');
    } catch {
      showToast('คัดลอกไม่สำเร็จ', 'error');
      return;
    }
    setCopiedId(id);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1800);
    if (secret) {
      showToast(`คัดลอกรหัสผ่านแล้ว (ล้างคลิปบอร์ดใน ${CLIPBOARD_CLEAR_SECONDS} วินาที)`);
      clearTimeout(clipTimer.current);
      clipTimer.current = setTimeout(() => {
        navigator.clipboard.writeText('').catch(() => {});
        clipTimer.current = null;
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } else {
      showToast('คัดลอกแล้ว');
    }
  };

  // ---------- เปลี่ยนอีเมลที่ใช้ล็อกอิน ----------
  const handleOpenEmailModal = () => {
    setEmailForm({ newEmail: '', password: '' });
    setEmailError('');
    setShowEmailPass(false);
    setIsProfileOpen(false);
    setIsEmailModalOpen(true);
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    if (savingEmail) return;
    const newEmail = emailForm.newEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('รูปแบบอีเมลไม่ถูกต้อง'); return; }
    if (newEmail === userEmail.toLowerCase()) { setEmailError('อีเมลใหม่ต้องไม่ซ้ำกับอีเมลเดิม'); return; }
    if (!emailForm.password) { setEmailError('กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน'); return; }

    setSavingEmail(true);
    setEmailError('');
    try {
      const res = await axios.put('/auth/email', { email: newEmail, password: emailForm.password });
      const saved = res.data?.email || newEmail;
      localStorage.setItem('email', saved);
      setUserEmail(saved);
      setIsEmailModalOpen(false);
      showToast('เปลี่ยนอีเมลที่ใช้ล็อกอินเรียบร้อย');
    } catch (err) {
      if (err?.response?.status === 401) { logoutRef.current && logoutRef.current(); return; }
      setEmailError(
        err?.response?.status === 409 ? 'อีเมลนี้ถูกใช้งานแล้ว'
          : err?.response?.data?.error || 'เปลี่ยนอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง'
      );
    } finally {
      setSavingEmail(false);
    }
  };

  // ---------- นำเข้า / ส่งออก CSV ----------
  const handleExport = () => {
    const blob = new Blob([buildCsv(vaultItems)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweetvault-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setIsExportOpen(false);
    showToast(`ส่งออก ${vaultItems.length} รายการแล้ว`);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('ไฟล์ใหญ่เกิน 2MB', 'error'); return; }

    const rows = parseCsv(await file.text());
    if (rows.length < 2) { showToast('ไม่พบข้อมูลในไฟล์ CSV', 'error'); return; }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = {};
    Object.entries(CSV_ALIASES).forEach(([k, names]) => {
      col[k] = header.findIndex((h) => names.includes(h));
    });
    if (col.title < 0 || col.password < 0) {
      showToast('CSV ต้องมีคอลัมน์ title (หรือ name) และ password', 'error');
      return;
    }

    const get = (r, k) => (col[k] >= 0 ? (r[col[k]] || '').trim() : '');
    const payloads = rows.slice(1).map((r) => {
      const cat = get(r, 'category');
      const title = get(r, 'title');
      return {
        title, username: get(r, 'username'), password: r[col.password] || '',
        category: CATEGORIES.some((c) => c.key === cat) ? cat : (guessCategory(title) || 'Logins'),
        notes: get(r, 'notes'), tag: get(r, 'tag') || 'Imported',
        imageUrl: '', isFavorite: false, isImported: true,
      };
    }).filter((p) => p.title && p.password);

    if (!payloads.length) { showToast('ไม่พบแถวที่นำเข้าได้', 'error'); return; }

    setImporting(true);
    let ok = 0, fail = 0;
    for (const p of payloads) {
      try {
        const res = await axios.post('/vault', { ...p, username: p.username || '-' });
        setVaultItems((prev) => [res.data, ...prev]);
        ok++;
      } catch (err) {
        if (err?.response?.status === 401) { setImporting(false); logoutRef.current && logoutRef.current(); return; }
        fail++;
      }
    }
    setImporting(false);
    showToast(`นำเข้าสำเร็จ ${ok} รายการ${fail ? ` • ไม่สำเร็จ ${fail}` : ''}`, fail && !ok ? 'error' : 'ok');
    if (ok) setActiveMenu('Imported');
  };

  // ---------- กรอง / เรียงลำดับ ----------
  const filteredVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let items = vaultItems.filter((i) =>
      !q || [i.title, i.username, i.notes, i.category, i.tag].some((v) => (v || '').toLowerCase().includes(q))
    );

    if (activeMenu === 'Favorites') items = items.filter((i) => i.isFavorite);
    else if (activeMenu === 'Imported') items = items.filter((i) => i.isImported);
    else if (activeMenu === 'Watchtower') items = items.filter(isRisky);
    else if (CATEGORIES.some((c) => c.key === activeMenu)) items = items.filter((i) => i.category === activeMenu);
    else if (activeMenu !== 'All Items') items = items.filter((i) => i.tag === activeMenu);

    const sorted = [...items];
    if (sortBy === 'az') sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'th'));
    else if (sortBy === 'fav') sorted.sort((a, b) => Number(!!b.isFavorite) - Number(!!a.isFavorite) || b.id - a.id);
    else sorted.sort((a, b) => b.id - a.id);
    return sorted;
    // eslint-disable-next-line
  }, [vaultItems, searchQuery, activeMenu, sortBy, passCount]);

  const currentStrength = getPasswordStrength(formData.password);
  const catBadge = (key) => (CATEGORIES.find((c) => c.key === key) || CATEGORIES[0]).badge;
  const allMenuKeys = [...MAIN_MENU.map((m) => m.key), ...CATEGORIES.map((c) => c.key), ...tags];

  // ================= RENDER =================
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-700 selection:bg-pink-400 selection:text-white relative">


      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-white border border-pink-200 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-modal-pop max-w-[90vw]">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'error' ? 'bg-rose-100 text-rose-500' : 'bg-pink-100 text-pink-600'}`}>
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          </div>
          <span className="text-xs font-bold text-slate-700">{toast.msg}</span>
        </div>
      )}

      {/* เตือนก่อนล็อกอัตโนมัติ */}
      {lockWarning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-amber-50 border border-amber-200 text-amber-700 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-modal-pop max-w-[92vw]">
          <Clock size={18} className="shrink-0" />
          <span className="text-xs font-bold">ตู้เซฟจะล็อกอัตโนมัติใน 1 นาที ขยับเมาส์หรือกดปุ่มใดก็ได้เพื่ออยู่ต่อ</span>
        </div>
      )}

      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between select-none sticky top-0 h-screen overflow-y-auto z-10">
        <div>
          <div className="h-16 px-6 flex items-center gap-3 border-b border-pink-50">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 text-white rounded-xl flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="font-extrabold text-slate-800 tracking-tight text-lg block leading-none">SweetVault</span>
              <span className="text-[11px] text-slate-400">ตู้เซฟรหัสผ่าน</span>
            </div>
          </div>

          <div className="p-4 space-y-6 text-xs font-medium text-slate-500">
            <div className="space-y-1">
              {MAIN_MENU.map((m) => (
                <NavBtn key={m.key} icon={m.icon} label={m.key} count={counts[m.key]}
                  active={activeMenu === m.key} onClick={() => setActiveMenu(m.key)} />
              ))}
            </div>

            <div>
              <p className="px-3.5 text-[11px] font-bold text-slate-400 mb-1.5">หมวดหมู่</p>
              <div className="space-y-1">
                {CATEGORIES.map((c) => (
                  <NavBtn key={c.key} icon={c.icon} label={c.key} count={counts[c.key]}
                    active={activeMenu === c.key} onClick={() => setActiveMenu(c.key)} />
                ))}
              </div>
            </div>

            <div>
              <p className="px-3.5 text-[11px] font-bold text-slate-400 mb-1.5">แท็ก</p>
              <div className="space-y-1">
                {tags.map((t) => (
                  <NavBtn key={t} icon={Tag} label={t}
                    active={activeMenu === t} onClick={() => setActiveMenu(t)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-pink-50 space-y-2">
          <div className="px-3 py-3 bg-pink-50/60 border border-pink-100 rounded-xl flex items-center gap-3" title={userEmail || undefined}>
            <AccountAvatar email={userEmail} size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-slate-400 leading-none mb-1">เข้าสู่ระบบด้วย</p>
              <p className="text-xs font-bold text-slate-700 truncate">{userEmail || 'ไม่พบข้อมูลอีเมล'}</p>
            </div>
          </div>
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-rose-500 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
          >
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">

        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 w-full max-w-xl">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Plus size={16} /> <span className="hidden sm:inline">บันทึกรหัสใหม่</span>
            </button>
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-3 text-pink-300" size={16} />
              <input
                ref={searchRef}
                type="text"
                placeholder="ค้นหา (Ctrl+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputCls} pl-10 pr-9 py-2.5 bg-white`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-300 hover:text-slate-500 cursor-pointer" title="ล้างคำค้น">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 relative shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              title="นำเข้าจากไฟล์ CSV"
              className="p-2.5 text-slate-400 hover:text-pink-500 bg-pink-50/70 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {importing ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
            </button>
            <button
              onClick={() => (vaultItems.length ? setIsExportOpen(true) : showToast('ยังไม่มีข้อมูลให้ส่งออก', 'error'))}
              title="ส่งออกเป็นไฟล์ CSV"
              className="p-2.5 text-slate-400 hover:text-pink-500 bg-pink-50/70 rounded-xl transition cursor-pointer"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => { setIsNotifOpen(!isNotifOpen); setIsProfileOpen(false); }}
              title="การแจ้งเตือน"
              className="p-2.5 text-slate-400 hover:text-pink-500 bg-pink-50/70 rounded-xl transition relative cursor-pointer"
            >
              <Bell size={18} />
              {stats.risky > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full animate-ping"></span>}
            </button>
            <button
              onClick={() => { setIsProfileOpen(!isProfileOpen); setIsNotifOpen(false); }}
              title={userEmail ? `บัญชี: ${userEmail}` : 'บัญชีของฉัน'}
              aria-haspopup="true"
              aria-expanded={isProfileOpen}
              className="flex items-center gap-2 pl-1.5 pr-2 md:pr-3 py-1.5 bg-pink-50/70 hover:bg-pink-100/70 rounded-xl transition cursor-pointer max-w-[200px] lg:max-w-[260px]"
            >
              <AccountAvatar email={userEmail} size="sm" />
              <span className="hidden lg:block text-xs font-bold text-slate-600 truncate">{userEmail || 'บัญชีของฉัน'}</span>
              <ChevronDown size={14} className={`hidden md:block text-slate-400 shrink-0 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 top-14 w-72 max-w-[88vw] bg-white rounded-2xl shadow-xl border border-pink-100 p-4 z-50 animate-modal-pop">
                <div className="flex items-center gap-3 pb-3 border-b border-pink-50">
                  <AccountAvatar email={userEmail} size="lg" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-slate-400 leading-none mb-1">เข้าสู่ระบบด้วย</p>
                    <p className="text-xs font-bold text-slate-800 break-all">{userEmail || 'ไม่พบข้อมูลอีเมล'}</p>
                  </div>
                </div>

                <dl className="py-3 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">รายการในตู้เซฟ</dt>
                    <dd className="font-bold text-slate-700">{stats.total} รายการ</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">เริ่มใช้งานรอบนี้</dt>
                    <dd className="font-bold text-slate-700">{sessionStartText} น.</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">ล็อกอัตโนมัติ</dt>
                    <dd className="font-bold text-slate-700">เมื่อไม่ใช้งาน {AUTO_LOCK_MINUTES} นาที</dd>
                  </div>
                </dl>

                <button
                  onClick={handleOpenEmailModal}
                  className="w-full mb-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit size={13} /> เปลี่ยนอีเมลที่ใช้ล็อกอิน
                </button>

                <div className="flex gap-2 pt-3 border-t border-pink-50">
                  {userEmail && (
                    <button
                      onClick={() => handleCopy(userEmail, 'account-email')}
                      className="w-1/2 py-2 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {copiedId === 'account-email' ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === 'account-email' ? 'คัดลอกแล้ว' : 'คัดลอกอีเมล'}
                    </button>
                  )}
                  <button
                    onClick={() => { setIsProfileOpen(false); setIsLogoutModalOpen(true); }}
                    className={`${userEmail ? 'w-1/2' : 'w-full'} py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5`}
                  >
                    <LogOut size={13} /> ออกจากระบบ
                  </button>
                </div>
              </div>
            )}

            {isNotifOpen && (
              <div className="absolute right-0 top-14 w-80 max-w-[85vw] bg-white rounded-2xl shadow-xl border border-pink-100 p-4 z-50 animate-modal-pop">
                <div className="flex justify-between items-center mb-3 px-1 border-b border-pink-50 pb-2">
                  <h4 className="font-extrabold text-xs text-slate-800">การแจ้งเตือนความปลอดภัย</h4>
                  <span className="text-[10px] text-pink-500 font-bold bg-pink-50 px-2 py-0.5 rounded-full">{notifications.length} รายการ</span>
                </div>
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-2.5 bg-pink-50/40 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        {n.type === 'warn'
                          ? <AlertCircle size={14} className="text-amber-500" />
                          : <CheckCircle2 size={14} className="text-pink-500" />}
                        {n.title}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{n.desc}</p>
                    </div>
                  ))}
                </div>
                {stats.risky > 0 && (
                  <button
                    onClick={() => { setActiveMenu('Watchtower'); setIsNotifOpen(false); }}
                    className="w-full mt-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl text-[11px] font-bold transition cursor-pointer"
                  >
                    ไปดูรายการที่ต้องแก้ไข
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6" onClick={() => { if (isNotifOpen) setIsNotifOpen(false); if (isProfileOpen) setIsProfileOpen(false); }}>

          {/* แถบเมนูมือถือ */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {allMenuKeys.map((k) => (
              <button
                key={k}
                onClick={() => setActiveMenu(k)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  activeMenu === k ? 'bg-pink-500 text-white' : 'bg-white border border-pink-100 text-slate-500'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* สรุปความปลอดภัย */}
          <section className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">สวัสดี, {userName}</h2>
              {userEmail && (
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 min-w-0">
                  <Mail size={11} className="shrink-0" />
                  <span className="shrink-0">เข้าสู่ระบบด้วย</span>
                  <span className="font-bold text-slate-600 truncate">{userEmail}</span>
                </p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">
                {stats.total === 0 ? 'เริ่มเก็บรหัสผ่านใบแรกของคุณกันเลย' : stats.risky === 0 ? 'ตู้เซฟของคุณปลอดภัยดี' : `มี ${stats.risky} รายการที่ควรปรับปรุงความปลอดภัย`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-44">
                <div className="flex justify-between text-[11px] font-medium text-slate-500 mb-1">
                  <span>คะแนนความปลอดภัย</span><span className="font-bold text-slate-800">{stats.score}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${stats.score >= 80 ? 'bg-emerald-500' : stats.score >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${stats.score}%` }} />
                </div>
              </div>
              {stats.risky > 0 && (
                <button onClick={() => setActiveMenu('Watchtower')} className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-lg text-xs font-bold transition cursor-pointer">
                  ดูรายการเสี่ยง ({stats.risky})
                </button>
              )}
            </div>
          </section>

          {/* หัวข้อ + เรียงลำดับ */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{activeMenu} <span className="text-pink-400">({filteredVaults.length})</span></h3>
              <p className="text-xs text-slate-400 mt-0.5">ล็อกอัตโนมัติเมื่อไม่ใช้งาน {AUTO_LOCK_MINUTES} นาที • กด Esc เพื่อปิดหน้าต่าง</p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 bg-white border border-pink-100 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-300 cursor-pointer"
            >
              <option value="newest">ใหม่ล่าสุด</option>
              <option value="az">ชื่อ ก-ฮ / A-Z</option>
              <option value="fav">รายการโปรดก่อน</option>
            </select>
          </div>

          {/* GRID CARDS */}
          {loadingItems ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="h-44 bg-white/70 rounded-2xl border border-pink-100 animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="py-16 text-center bg-white/80 rounded-2xl border border-dashed border-rose-200">
              <div className="w-14 h-14 bg-rose-50 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-3"><AlertCircle size={26} /></div>
              <p className="text-sm font-bold text-slate-600">โหลดข้อมูลไม่สำเร็จ</p>
              <button onClick={loadItems} className="mt-3 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                <RefreshCw size={13} /> ลองอีกครั้ง
              </button>
            </div>
          ) : (
            filteredVaults.length === 0 ? (
              <div className="py-16 text-center bg-white border border-dashed border-slate-300 rounded-xl">
                <div className="w-12 h-12 bg-pink-50 text-pink-400 rounded-xl flex items-center justify-center mx-auto mb-3"><Lock size={22} /></div>
                <p className="text-sm font-bold text-slate-700">
                  {searchQuery ? 'ไม่พบรายการที่ค้นหา' : activeMenu === 'Watchtower' ? 'ยอดเยี่ยม! ไม่มีรายการเสี่ยง' : 'ยังไม่มีรายการในหมวดนี้'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchQuery ? 'ลองเปลี่ยนคำค้นหา' : 'เพิ่มรหัสผ่านใหม่ หรือนำเข้าจากไฟล์ CSV'}
                </p>
                {!searchQuery && activeMenu !== 'Watchtower' && (
                  <button onClick={handleOpenAddModal} className="mt-4 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <Plus size={14} /> บันทึกรหัสใหม่
                  </button>
                )}
              </div>
            ) : (
              <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {filteredVaults.map((vault) => (
                  <li key={vault.id} onClick={() => setSelectedItemForView(vault)}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-pink-50/40 cursor-pointer transition-colors">
                    <Logo item={vault} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 truncate">{vault.title}</h4>
                        {vault.isFavorite && <Star size={12} className="fill-amber-400 text-amber-400 shrink-0" />}
                        {isWeak(vault) && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-500 shrink-0">รหัสอ่อน</span>}
                        {isReused(vault) && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 shrink-0">รหัสซ้ำ</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{vault.username}</p>
                    </div>
                    <span className={`hidden sm:inline text-[11px] font-medium px-2 py-0.5 rounded-md ${catBadge(vault.category)}`}>{vault.category}</span>
                    <div className="flex items-center shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                      <IconBtn title={vault.isFavorite ? 'เอาออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'} onClick={(e) => handleToggleFavorite(vault.id, e)}>
                        <Star size={16} className={vault.isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                      </IconBtn>
                      <IconBtn title="คัดลอกชื่อผู้ใช้" onClick={(e) => handleCopy(vault.username, `u-${vault.id}`, false, e)}>
                        {copiedId === `u-${vault.id}` ? <Check size={16} className="text-emerald-500" /> : <User size={16} />}
                      </IconBtn>
                      <IconBtn title="คัดลอกรหัสผ่าน" onClick={(e) => handleCopy(vault.password, `pw-${vault.id}`, true, e)}>
                        {copiedId === `pw-${vault.id}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </IconBtn>
                      <IconBtn title="แก้ไขข้อมูล" onClick={(e) => handleOpenEditModal(vault, e)}><Edit size={16} /></IconBtn>
                      <IconBtn title="ลบ" danger onClick={(e) => { e.stopPropagation(); setDeleteTarget(vault); }}><Trash2 size={16} /></IconBtn>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </main>

      {/* ================= MODAL เปลี่ยนอีเมล ================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => !savingEmail && setIsEmailModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-pink-100 relative animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsEmailModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={20} /></button>

            <h3 className="font-black text-lg text-slate-800 mb-1 flex items-center gap-2">
              <Mail className="text-pink-500" size={20} /> เปลี่ยนอีเมลที่ใช้ล็อกอิน
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">ครั้งต่อไปให้ล็อกอินด้วยอีเมลใหม่ ข้อมูลในตู้เซฟจะไม่เปลี่ยนแปลง</p>

            <form onSubmit={handleChangeEmail} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">อีเมลปัจจุบัน</label>
                <div className={`${inputCls} bg-slate-50 text-slate-500 break-all`}>{userEmail || '-'}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">อีเมลใหม่</label>
                <input type="email" autoFocus required autoComplete="off" placeholder="name@example.com"
                  value={emailForm.newEmail}
                  onChange={(e) => { setEmailForm({ ...emailForm, newEmail: e.target.value }); setEmailError(''); }}
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">รหัสผ่านสำหรับล็อกอิน (ยืนยันตัวตน)</label>
                <div className="relative">
                  <input type={showEmailPass ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••"
                    value={emailForm.password}
                    onChange={(e) => { setEmailForm({ ...emailForm, password: e.target.value }); setEmailError(''); }}
                    className={`${inputCls} pr-11`} />
                  <button type="button" onClick={() => setShowEmailPass(!showEmailPass)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer">
                    {showEmailPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {emailError && (
                <p className="text-[11px] font-bold text-rose-500 flex items-center gap-1.5" role="alert">
                  <AlertCircle size={13} className="shrink-0" /> {emailError}
                </p>
              )}

              <div className="pt-1 flex gap-3">
                <button type="button" onClick={() => setIsEmailModalOpen(false)} disabled={savingEmail}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">ยกเลิก</button>
                <button type="submit" disabled={savingEmail}
                  className="w-1/2 py-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition cursor-pointer">
                  {savingEmail ? 'กำลังบันทึก...' : 'บันทึกอีเมลใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL ออกจากระบบ ================= */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none" onClick={() => setIsLogoutModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-pink-100 animate-modal-pop text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"><LogOut size={28} /></div>
            <h3 className="font-black text-lg text-slate-800 mb-1">ยืนยันการออกจากระบบ</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">คุณต้องการออกจากระบบตู้เซฟ SweetVault ใช่หรือไม่?</p>
            {userEmail && (
              <p className="text-[11px] font-bold text-slate-600 bg-pink-50/60 border border-pink-100 rounded-lg px-3 py-2 mb-6 break-all">{userEmail}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">ยกเลิก</button>
              <button onClick={() => { setIsLogoutModalOpen(false); onLogout(); }} className="w-1/2 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition cursor-pointer">ออกจากระบบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ส่งออก ================= */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none" onClick={() => setIsExportOpen(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-pink-100 animate-modal-pop text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"><Download size={28} /></div>
            <h3 className="font-black text-lg text-slate-800 mb-1">ส่งออกข้อมูล {vaultItems.length} รายการ</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              ไฟล์ CSV จะเก็บรหัสผ่านเป็นข้อความธรรมดา ไม่ได้เข้ารหัส เก็บไว้ในที่ปลอดภัยและลบทิ้งเมื่อใช้งานเสร็จ
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsExportOpen(false)} className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleExport} className="w-1/2 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl text-xs transition cursor-pointer">ดาวน์โหลด</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ยืนยันลบ ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[55] p-4 select-none" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-pink-100 animate-modal-pop text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner"><Trash2 size={28} /></div>
            <h3 className="font-black text-lg text-slate-800 mb-1">ลบรายการนี้?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              “{deleteTarget.title}” จะถูกลบออกจากตู้เซฟอย่างถาวร และไม่สามารถกู้คืนได้
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">ยกเลิก</button>
              <button onClick={confirmDelete} className="w-1/2 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition cursor-pointer">ลบรายการ</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL เพิ่ม / แก้ไข ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-8 shadow-2xl border border-pink-100 relative animate-modal-pop">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={20} /></button>

            <h3 className="font-black text-lg text-slate-800 mb-6 flex items-center gap-2">
              <ShieldCheck className="text-pink-500" size={22} />
              {editingItem ? 'แก้ไขรายการในตู้เซฟ' : 'เพิ่มรหัสผ่านใหม่เข้าตู้เซฟ'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">ชื่อบริการ / แอปพลิเคชัน</label>
                <input type="text" required autoFocus placeholder="เช่น YouTube, Spotify" value={formData.title}
                  onChange={handleTitleChange} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">รูปภาพโลโก้ (ลิงก์รูป)</label>
                <div className="flex items-center gap-3">
                  <input type="text" placeholder="วางลิงก์รูปที่นี่ เช่น https://example.com/logo.png" value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} className={inputCls} />
                  <Logo item={{ title: formData.title || '?', imageUrl: normalizeUrl(formData.imageUrl) }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">ชื่อผู้ใช้ / อีเมล</label>
                <input type="text" required placeholder="username@email.com" value={formData.username}
                  autoComplete="off"
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'} required placeholder="••••••••"
                    value={formData.password} autoComplete="new-password"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`${inputCls} pr-11`}
                  />
                  <button type="button" onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer">
                    {showFormPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400">ระดับความปลอดภัย:</span>
                      <span className={currentStrength.textColor}>{currentStrength.text}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${currentStrength.color}`} style={{ width: `${currentStrength.score}%` }}></div>
                    </div>
                    {passCount[formData.password] > (editingItem && editingItem.password === formData.password ? 1 : 0) && (
                      <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 pt-0.5">
                        <AlertCircle size={11} /> รหัสนี้ถูกใช้ในรายการอื่นแล้ว
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">หมวดหมู่</label>
                  <select value={formData.category}
                    onChange={(e) => { setFormData({ ...formData, category: e.target.value }); setCategoryTouched(true); setAutoCat(false); }}
                    className={`${inputCls} cursor-pointer`}>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
                  </select>
                  {autoCat && (
                    <p className="text-[10px] font-bold text-pink-500 mt-1 ml-1 flex items-center gap-1">
                      <Sparkles size={11} /> จัดให้อัตโนมัติจากชื่อบริการ
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">แท็ก</label>
                  <input type="text" list="tag-options" maxLength={30} value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })} className={inputCls} />
                  <datalist id="tag-options">{tags.map((t) => <option key={t} value={t} />)}</datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 ml-1">โน้ต (ไม่บังคับ)</label>
                <textarea rows={3} placeholder="เช่น คำตอบกู้คืนบัญชี, วันหมดอายุ..." value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={`${inputCls} resize-none`} />
              </div>

              <label className="flex items-center gap-2 px-1 cursor-pointer select-none">
                <input type="checkbox" checked={formData.isFavorite}
                  onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
                  className="w-4 h-4 rounded accent-pink-500 cursor-pointer" />
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><Star size={13} className="text-amber-400" /> ตั้งเป็นรายการโปรด</span>
              </label>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer">ยกเลิก</button>
                <button type="submit" disabled={saving}
                  className="w-1/2 py-3.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                  <Sparkles size={14} /> {saving ? 'กำลังบันทึก...' : editingItem ? 'อัปเดตข้อมูล' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL ดูรายละเอียด ================= */}
      {selectedItemForView && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setSelectedItemForView(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-pink-100 relative animate-modal-pop" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedItemForView(null)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={20} /></button>
            <button onClick={(e) => handleToggleFavorite(selectedItemForView.id, e)} className="absolute top-6 left-6 p-1 cursor-pointer">
              <Star size={18} className={selectedItemForView.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <Logo item={selectedItemForView} size="lg" />
              <h3 className="font-black text-xl text-slate-800 mt-3 break-words max-w-full">{selectedItemForView.title}</h3>
              <div className="flex flex-wrap justify-center gap-1.5 mt-1.5">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${catBadge(selectedItemForView.category)}`}>{selectedItemForView.category}</span>
                {selectedItemForView.tag && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-500">{selectedItemForView.tag}</span>}
                {isWeak(selectedItemForView) && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-500">รหัสอ่อน</span>}
                {isReused(selectedItemForView) && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-600">รหัสซ้ำ</span>}
              </div>
            </div>

            <div className="space-y-4 text-xs font-medium bg-pink-50/30 p-4 rounded-xl border border-pink-100 mb-4">
              <div>
                <span className="text-slate-400 block text-[11px] font-medium mb-1">ชื่อผู้ใช้ / อีเมล</span>
                <div className="flex justify-between items-center text-slate-700 font-bold gap-3">
                  <span className="truncate">{selectedItemForView.username}</span>
                  <button onClick={() => handleCopy(selectedItemForView.username, 'm-user')} className="text-pink-500 hover:underline cursor-pointer shrink-0">
                    {copiedId === 'm-user' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-pink-100">
                <span className="text-slate-400 block text-[11px] font-medium mb-1">รหัสผ่าน</span>
                <div className="flex justify-between items-center text-slate-700 font-bold gap-3">
                  <span className="truncate font-mono">{showPasswordMap[selectedItemForView.id] ? selectedItemForView.password : '••••••••••••'}</span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setShowPasswordMap({ ...showPasswordMap, [selectedItemForView.id]: !showPasswordMap[selectedItemForView.id] })}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      {showPasswordMap[selectedItemForView.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => handleCopy(selectedItemForView.password, 'm-pass', true)} className="text-pink-500 hover:underline cursor-pointer">
                      {copiedId === 'm-pass' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                  </div>
                </div>
              </div>

              {selectedItemForView.password && (() => {
                const st = getPasswordStrength(selectedItemForView.password);
                return (
                  <div className="pt-3 border-t border-pink-100">
                    <div className="flex justify-between text-[11px] font-medium mb-1">
                      <span className="text-slate-400">ระดับความปลอดภัย</span>
                      <span className={st.textColor}>{st.text}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${st.color}`} style={{ width: `${st.score}%` }} />
                    </div>
                  </div>
                );
              })()}

              {selectedItemForView.notes && (
                <div className="pt-3 border-t border-pink-100">
                  <span className="text-slate-400 block text-[11px] font-medium mb-1">โน้ต</span>
                  <p className="text-slate-600 whitespace-pre-wrap break-words">{selectedItemForView.notes}</p>
                </div>
              )}
            </div>

            {selectedItemForView.createdAt && (
              <p className="text-[10px] text-slate-400 text-center mb-4">
                เพิ่มเมื่อ {new Date(selectedItemForView.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={(e) => handleOpenEditModal(selectedItemForView, e)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                <Edit size={14} /> แก้ไข
              </button>
              <button onClick={() => setDeleteTarget(selectedItemForView)}
                className="w-1/2 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5">
                <Trash2 size={14} /> ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
