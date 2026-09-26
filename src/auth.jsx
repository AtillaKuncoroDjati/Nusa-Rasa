import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle,
  Mail,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { api } from './api';
import { useApp, Notice, Spinner } from './App';
export default function AuthPage() {
  const { user, ready, acceptSession, config, notice } = useApp(),
    location = useLocation(),
    navigate = useNavigate();
  const path = location.pathname,
    register = path === '/daftar',
    forgot = path === '/lupa-kata-sandi',
    reset = path === '/reset-password';
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [show, setShow] = useState(false);
  useEffect(() => {
    setError('');
    setSuccess('');
    setShow(false);
  }, [path]);
  const from = location.state?.from;
  const destination =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
  useEffect(() => {
    if (ready && user && !reset && !forgot) navigate(destination, { replace: true });
  }, [ready, user, reset, forgot, destination, navigate]);
  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (forgot) {
        const result = await api('/auth/forgot', { method: 'POST', body: { email: d.email } });
        setSuccess(result.message);
      } else if (reset) {
        if (d.password !== d.confirm) throw new Error('Konfirmasi kata sandi belum sesuai.');
        await api('/auth/reset', {
          method: 'POST',
          body: { token: location.hash.slice(1), password: d.password },
        });
        acceptSession({ user: null, csrf: null });
        setSuccess('Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.');
      } else {
        if (register && d.password !== d.confirm)
          throw new Error('Konfirmasi kata sandi belum sesuai.');
        const result = await api('/auth/' + (register ? 'register' : 'login'), {
          method: 'POST',
          body: register
            ? { name: d.name, email: d.email, password: d.password }
            : { email: d.email, password: d.password },
        });
        acceptSession(result);
        navigate(destination, { replace: true });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const title = register
    ? 'Mulai cerita rasamu.'
    : forgot
      ? 'Lupa kata sandi?'
      : reset
        ? 'Kata sandi baru.'
        : 'Selamat datang kembali.';
  return (
    <div className="auth-shell">
      <section className="auth-brand">
        <Link to="/" className="auth-back">
          <ArrowLeft size={18} /> Kembali ke beranda
        </Link>
        <div className="auth-brand-center">
          <img src="/favicon.svg" alt="" />
          <h1>NusaRasa</h1>
          <p>
            Sejuta rasa.
            <br />
            Satu tempat untuk berbagi.
          </p>
        </div>
        <div className="auth-brand-footer">
          <span>01 — DARI DAPUR KITA</span>
          <span>UNTUK NUSANTARA</span>
        </div>
        <i className="auth-orbit one" />
        <i className="auth-orbit two" />
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <span className="eyebrow">SELAMAT DATANG DI NUSA RASA</span>
          <h2>{title}</h2>
          <p>
            {register
              ? 'Simpan resep favorit dan bagikan kreasi dari dapurmu.'
              : forgot
                ? 'Kami akan mengirimkan tautan untuk mengatur ulang kata sandimu.'
                : reset
                  ? 'Pilih kata sandi yang kuat dan mudah kamu ingat.'
                  : 'Masuk untuk melanjutkan petualangan rasa.'}
          </p>
          <Notice>{error || notice}</Notice>
          {!ready ? (
            <Spinner />
          ) : success ? (
            <div className="auth-success">
              <CheckCircle size={34} />
              <p>{success}</p>
              <Link to="/masuk" className="button dark">
                Kembali ke halaman masuk
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} key={path}>
              {register && (
                <label>
                  Nama lengkap
                  <div className="input-icon">
                    <UserRound size={18} />
                    <input
                      name="name"
                      autoComplete="name"
                      placeholder="Nama kamu"
                      required
                      minLength={2}
                      maxLength={60}
                    />
                  </div>
                </label>
              )}
              {!reset && (
                <label>
                  Email
                  <div className="input-icon">
                    <Mail size={18} />
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nama@email.com"
                      required
                      maxLength={254}
                    />
                  </div>
                </label>
              )}
              {!forgot && (
                <label>
                  Kata sandi
                  <div className="input-icon">
                    <LockKeyhole size={18} />
                    <input
                      name="password"
                      type={show ? 'text' : 'password'}
                      autoComplete={register || reset ? 'new-password' : 'current-password'}
                      placeholder={
                        register || reset ? 'Minimal 10 karakter' : 'Masukkan kata sandi'
                      }
                      minLength={register || reset ? 10 : 1}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {(register || reset) && (
                <label>
                  Konfirmasi kata sandi
                  <div className="input-icon">
                    <LockKeyhole size={18} />
                    <input
                      name="confirm"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi"
                      required
                      minLength={10}
                      maxLength={128}
                    />
                  </div>
                </label>
              )}
              {!register && !forgot && !reset && (
                <Link className="forgot-link" to="/lupa-kata-sandi">
                  Lupa kata sandi?
                </Link>
              )}
              {forgot && !config.passwordResetEnabled && (
                <Notice>Pemulihan lewat email belum tersedia. Hubungi pengelola aplikasi.</Notice>
              )}
              <button
                className="button dark auth-submit"
                disabled={busy || (forgot && !config.passwordResetEnabled)}
              >
                {busy
                  ? 'Sebentar, ya…'
                  : register
                    ? 'Buat akun'
                    : forgot
                      ? 'Kirim tautan pemulihan'
                      : reset
                        ? 'Simpan kata sandi'
                        : 'Masuk'}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {!forgot && !reset && (
            <p className="auth-switch">
              {register ? 'Sudah punya akun?' : 'Baru di Nusa Rasa?'}{' '}
              <Link to={register ? '/masuk' : '/daftar'} state={{ from: destination }}>
                {register ? 'Masuk di sini' : 'Daftar sekarang'}
              </Link>
            </p>
          )}
          {forgot && (
            <Link className="auth-switch" to="/masuk">
              Ingat kata sandinya? Masuk di sini
            </Link>
          )}
        </div>
        <p className="auth-note">Resep yang baik dimulai dari rasa ingin berbagi.</p>
      </section>
    </div>
  );
}
