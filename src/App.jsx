import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  House,
  Compass,
  SquarePlus,
  Bell,
  Bookmark,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
  Utensils,
  LoaderCircle,
} from 'lucide-react';
import { api, setCsrf } from './api';
import { RecipeList, RecipeDetail, Notifications, Profile } from './pages';
import { RecipeEditor, ProfileEditor } from './editors';
import AuthPage from './auth';
const Context = createContext();
export const useApp = () => useContext(Context);
export function Avatar({ user, size = '' }) {
  return user?.avatar ? (
    <img className={'avatar ' + size} src={user.avatar} alt="" />
  ) : (
    <span className={'avatar initials ' + size} aria-hidden="true">
      {(user?.name || 'NR')
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function Spinner() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" /> Menyiapkan dapur…
    </div>
  );
}
export function Notice({ children }) {
  return children ? (
    <div className="error-box" role="alert">
      {children}
    </div>
  ) : null;
}
export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Utensils size={32} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function RequireUser({ children }) {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Spinner />;
  return user ? (
    children
  ) : (
    <Empty title="Dapurmu menunggu.">
      Masuk untuk menyimpan resep, berbagi kreasi, dan terhubung dengan pencinta masakan Nusantara.
      <Link
        className="button primary"
        to="/masuk"
        state={{ from: location.pathname + location.search }}
      >
        Masuk ke Nusa Rasa <ArrowUpRight size={17} />
      </Link>
    </Empty>
  );
}

function Layout({ children }) {
  const { user, logout, notice } = useApp(),
    location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const sidebarRef = useRef(null),
    menuRef = useRef(null),
    mainRef = useRef(null);
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mainRef.current.inert = true;
    const items = () =>
      Array.from(sidebarRef.current.querySelectorAll('a,button,input')).filter(
        (node) => node.getClientRects().length,
      );
    sidebarRef.current.querySelector('.nav-close').focus();
    const key = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
      if (e.key === 'Tab') {
        const focusable = items(),
          first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const resize = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    document.addEventListener('keydown', key);
    window.addEventListener('resize', resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (mainRef.current) mainRef.current.inert = false;
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', resize);
      menuRef.current?.focus();
    };
  }, [open]);
  const links = [
    ['/', 'Beranda', House],
    ['/jelajahi', 'Jelajahi', Compass],
    ['/unggah', 'Unggah resep', SquarePlus],
    ['/notifikasi', 'Notifikasi', Bell],
    ['/penanda', 'Penanda', Bookmark],
  ];
  const submit = (e) => {
    e.preventDefault();
    navigate('/cari?q=' + encodeURIComponent(query.trim()));
    setOpen(false);
  };
  const titles = location.pathname.startsWith('/resep/')
    ? 'Dari dapur Nusantara'
    : {
        '/': 'Selamat datang di dapur kita',
        '/jelajahi': 'Jelajahi Masakan Nusantara',
        '/cari': 'Temukan resep favoritmu',
        '/penanda': 'Resep yang Kamu Simpan',
        '/profil': 'Dapur Saya',
        '/profil/edit': 'Edit Profil',
        '/unggah': 'Bagikan Resepmu',
        '/notifikasi': 'Notifikasi',
      }[location.pathname] || 'Nusa Rasa';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        Lewati ke konten
      </a>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="main-navigation"
        className={'sidebar ' + (open ? 'is-open' : '')}
        aria-label="Navigasi utama"
      >
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" />
          <span>
            Nusa<span className="brand-light">Rasa</span>
          </span>
        </Link>
        <button
          className="nav-close icon-button"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <form onSubmit={submit} className="side-search">
          <Search size={19} />
          <input
            aria-label="Cari resep"
            placeholder="Cari resep…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
          />
          <kbd>↵</kbd>
        </form>
        <p className="nav-caption">MENU UTAMA</p>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink to={to} end={to === '/'} key={to}>
              <Icon size={21} />
              <span>{label}</span>
              <ChevronRight className="nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-message">
            <Utensils size={23} />
            <p>
              Setiap resep punya cerita.
              <br />
              <strong>Apa ceritamu hari ini?</strong>
            </p>
            <Link to="/unggah">
              Yuk, bagikan <ArrowUpRight size={17} />
            </Link>
          </div>
          {user ? (
            <button
              className="logout"
              onClick={() => {
                setOpen(false);
                logout();
              }}
            >
              <LogOut size={18} /> Keluar
            </button>
          ) : (
            <Link className="logout" to="/masuk">
              <LogOut size={18} /> Masuk ke akun
            </Link>
          )}
          <small>Rasa lokal. Cerita tak terbatas.</small>
        </div>
      </aside>
      <div className="main-shell" ref={mainRef}>
        <header className="topbar">
          <button
            ref={menuRef}
            aria-controls="main-navigation"
            className="mobile-menu icon-button"
            aria-label="Buka menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="page-title">
            <span className="eyebrow">DARI DAPUR, UNTUK NUSANTARA</span>
            <h1>{titles}</h1>
          </div>
          <div className="header-actions">
            {user ? (
              <>
                <Link to="/notifikasi" className="icon-button" aria-label="Buka notifikasi">
                  <Bell size={20} />
                </Link>
                <Link to="/profil" className="account" aria-label={'Profil ' + user.name}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>Lihat profil</span>
                  </div>
                  <Avatar user={user} />
                </Link>
              </>
            ) : (
              <Link className="button dark small" to="/masuk">
                Masuk <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
        </header>
        <main id="content">
          {notice && <Notice>{notice}</Notice>}
          {children}
        </main>
        <footer className="footer">
          <Link to="/">
            NusaRasa<span>®</span>
          </Link>
          <span>Dibuat dengan rasa, dibagikan dengan cinta.</span>
          <small>Dibuat oleh Tim Nusa Rasa</small>
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [config, setConfig] = useState({ regions: [], passwordResetEnabled: false }),
    [notice, setNotice] = useState(''),
    [toast, setToast] = useState('');
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    Promise.all([api('/session'), api('/config')])
      .then(([session, cfg]) => {
        setUser(session.user);
        setCsrf(session.csrf);
        setConfig(cfg);
      })
      .catch((e) => setNotice(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  const acceptSession = (data) => {
    setUser(data.user);
    setCsrf(data.csrf);
    setNotice('');
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setCsrf(null);
      navigate('/');
      setToast('Kamu sudah keluar. Sampai jumpa di dapur!');
    } catch (e) {
      setToast(e.message);
    }
  };
  const value = { user, setUser, ready, config, notice, toast: setToast, acceptSession, logout };
  const authPage = ['/masuk', '/daftar', '/lupa-kata-sandi', '/reset-password'].includes(
    location.pathname,
  );
  return (
    <Context.Provider value={value}>
      {authPage ? (
        <AuthPage />
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<RecipeList />} />
            <Route path="/jelajahi" element={<RecipeList kind="explore" />} />
            <Route path="/cari" element={<RecipeList kind="search" />} />
            <Route
              path="/penanda"
              element={
                <RequireUser>
                  <RecipeList kind="saved" />
                </RequireUser>
              }
            />
            <Route path="/resep/:id" element={<RecipeDetail />} />
            <Route
              path="/unggah"
              element={
                <RequireUser>
                  <RecipeEditor />
                </RequireUser>
              }
            />
            <Route
              path="/resep/:id/edit"
              element={
                <RequireUser>
                  <RecipeEditor />
                </RequireUser>
              }
            />
            <Route
              path="/profil"
              element={
                <RequireUser>
                  <Profile />
                </RequireUser>
              }
            />
            <Route
              path="/profil/edit"
              element={
                <RequireUser>
                  <ProfileEditor />
                </RequireUser>
              }
            />
            <Route
              path="/notifikasi"
              element={
                <RequireUser>
                  <Notifications />
                </RequireUser>
              }
            />
            <Route
              path="*"
              element={
                <Empty
                  title="Halaman belum ditemukan."
                  action={
                    <Link className="button primary" to="/">
                      Kembali ke beranda
                    </Link>
                  }
                >
                  Masih banyak resep enak yang menunggumu di beranda.
                </Empty>
              }
            />
          </Routes>
        </Layout>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Tutup pemberitahuan" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
