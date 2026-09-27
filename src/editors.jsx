import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Plus,
  Trash2,
  UploadCloud,
  Check,
  Save,
  ImagePlus,
} from 'lucide-react';
import { api, uploadImage } from './api';
import { useApp, Avatar, Notice, Spinner } from './App';
import { VideoUpload } from './video';
const blank = {
  title: '',
  description: '',
  region: 'Jawa Barat',
  minutes: 30,
  servings: 2,
  image: '',
  video: '',
  ingredients: [''],
  steps: [''],
};
export function PhotoUpload({ value, onChange, label = 'Foto masakan', onBusy }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function choose(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) {
      setError('Foto maksimal 5 MB.');
      return;
    }
    setBusy(true);
    onBusy?.(true);
    try {
      const result = await uploadImage(file);
      onChange(result.path);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      onBusy?.(false);
      e.target.value = '';
    }
  }
  return (
    <div>
      <label className={'photo-upload ' + (value ? 'has-photo' : '')}>
        {value ? (
          <>
            <img src={value} alt="Pratinjau foto yang diunggah" />
            <span className="change-photo">
              <Camera size={18} /> {busy ? 'Mengunggah…' : 'Ganti foto'}
            </span>
          </>
        ) : (
          <>
            <span className="upload-symbol">
              <ImagePlus size={35} />
            </span>
            <strong>{busy ? 'Mengunggah fotomu…' : label}</strong>
            <span>Klik untuk memilih foto</span>
            <small>JPG, PNG, atau WebP · maksimal 5 MB</small>
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={label}
          onChange={choose}
          disabled={busy}
        />
      </label>
      <Notice>{error}</Notice>
    </div>
  );
}
export function RecipeEditor() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { config, user, toast } = useApp();
  const [form, setForm] = useState(blank),
    [loading, setLoading] = useState(Boolean(id)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [videoUploading, setVideoUploading] = useState(false),
    [step, setStep] = useState(0),
    [confirmDelete, setConfirmDelete] = useState(false);
  const dialog = useRef();
  useEffect(() => {
    if (!id) {
      setForm({ ...blank, ingredients: [''], steps: [''] });
      setLoading(false);
      return;
    }
    let live = true;
    api('/recipes/' + id)
      .then((d) => {
        if (d.recipe.author_id !== user.id)
          throw new Error('Hanya pemilik yang dapat mengedit resep ini.');
        if (live) {
          setForm(d.recipe);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [id, user.id]);
  useEffect(() => {
    if (confirmDelete) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmDelete]);
  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const changeRow = (field, index, value) =>
    setForm((f) => ({ ...f, [field]: f[field].map((v, i) => (i === index ? value : v)) }));
  function next(e) {
    e.preventDefault();
    if (uploading || videoUploading) return;
    if (!form.image) {
      setError('Tambahkan foto masakanmu terlebih dahulu.');
      return;
    }
    setError('');
    setStep(1);
    window.scrollTo(0, 0);
  }
  async function submit(e) {
    e.preventDefault();
    if (uploading || videoUploading) return;
    setError('');
    setBusy(true);
    try {
      const data = {
        title: form.title,
        description: form.description,
        region: form.region,
        image: form.image,
        video: form.video || '',
        minutes: Number(form.minutes),
        servings: Number(form.servings),
        ingredients: form.ingredients.map((x) => x.trim()),
        steps: form.steps.map((x) => x.trim()),
      };
      const result = await api(id ? '/recipes/' + id : '/recipes', {
        method: id ? 'PUT' : 'POST',
        body: data,
      });
      toast(id ? 'Perubahan resep berhasil disimpan.' : 'Resepmu sudah diterbitkan di Nusa Rasa.');
      navigate('/resep/' + result.recipe.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api('/recipes/' + id, { method: 'DELETE' });
      toast('Resep berhasil dihapus.');
      navigate('/profil');
    } catch (e) {
      setError(e.message);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Spinner />;
  if (id && form.author_id !== user.id) return <Notice>{error || 'Resep tidak tersedia.'}</Notice>;
  return (
    <section className="editor-page">
      <Link className="back-link" to={id ? '/resep/' + id : '/profil'}>
        <ArrowLeft size={17} /> {id ? 'Kembali ke resep' : 'Dapur saya'}
      </Link>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">RESEP BARU, CERITA BARU</span>
          <h2>{id ? 'Rapikan resep andalanmu.' : 'Dari dapurmu, untuk semua.'}</h2>
          <p>Bagikan resep dan langkah memasak yang mudah diikuti.</p>
        </div>
        <div className="step-indicator">
          <span className={step === 0 ? 'current' : 'complete'}>
            {step === 1 ? <Check size={16} /> : '1'}
          </span>
          <i />
          <span className={step === 1 ? 'current' : ''}>2</span>
        </div>
      </div>
      <Notice>{error}</Notice>
      <form onSubmit={step === 0 ? next : submit}>
        <div className="editor-grid">
          <div className="editor-photo">
            <PhotoUpload
              value={form.image}
              onChange={(v) => set('image', v)}
              onBusy={setUploading}
            />
            <div className="photo-tip">
              <Camera size={21} />
              <p>
                Cahaya alami membuat masakanmu semakin menggugah selera. Gunakan foto hasil
                masakanmu sendiri.
              </p>
            </div>
            <VideoUpload
              value={form.video || ''}
              poster={form.image}
              onChange={(v) => set('video', v)}
              onBusy={setVideoUploading}
              disabled={busy}
            />
          </div>
          <div className="editor-fields">
            {step === 0 ? (
              <>
                <h3>Kenalkan masakanmu</h3>
                <label>
                  Nama resep
                  <input
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    placeholder="Contoh: Karedok spesial keluarga"
                    required
                    minLength={5}
                    maxLength={100}
                  />
                </label>
                <label>
                  Cerita singkat
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Apa yang membuat resep ini istimewa?"
                    required
                    minLength={20}
                    maxLength={1200}
                  />
                  <small>{form.description.length}/1200</small>
                </label>
                <label>
                  Asal daerah
                  <select value={form.region} onChange={(e) => set('region', e.target.value)}>
                    {config.regions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <div className="field-pair">
                  <label>
                    Waktu memasak (menit)
                    <input
                      type="number"
                      value={form.minutes}
                      onChange={(e) => set('minutes', e.target.value)}
                      min="1"
                      max="1440"
                      required
                    />
                  </label>
                  <label>
                    Jumlah porsi
                    <input
                      type="number"
                      value={form.servings}
                      onChange={(e) => set('servings', e.target.value)}
                      min="1"
                      max="100"
                      required
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <h3>Bahan-bahan</h3>
                <p className="field-help">Tulis satu bahan beserta takarannya di setiap baris.</p>
                {form.ingredients.map((v, i) => (
                  <div className="dynamic-row" key={i}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <input
                      aria-label={'Bahan ' + (i + 1)}
                      value={v}
                      onChange={(e) => changeRow('ingredients', i, e.target.value)}
                      placeholder="200 g kacang tanah goreng"
                      required
                      minLength={2}
                      maxLength={200}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={'Hapus bahan ' + (i + 1)}
                      disabled={form.ingredients.length === 1}
                      onClick={() =>
                        set(
                          'ingredients',
                          form.ingredients.filter((_, n) => i !== n),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-row"
                  disabled={form.ingredients.length >= 50}
                  onClick={() => set('ingredients', [...form.ingredients, ''])}
                >
                  <Plus size={16} />
                  Tambah bahan
                </button>
                <h3 className="steps-title">Cara membuat</h3>
                <p className="field-help">Urutkan langkah dari persiapan sampai siap disajikan.</p>
                {form.steps.map((v, i) => (
                  <div className="dynamic-row step-row" key={i}>
                    <span>{i + 1}</span>
                    <textarea
                      aria-label={'Langkah ' + (i + 1)}
                      value={v}
                      onChange={(e) => changeRow('steps', i, e.target.value)}
                      placeholder="Ceritakan langkah memasaknya…"
                      required
                      minLength={5}
                      maxLength={1200}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={'Hapus langkah ' + (i + 1)}
                      disabled={form.steps.length === 1}
                      onClick={() =>
                        set(
                          'steps',
                          form.steps.filter((_, n) => i !== n),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-row"
                  disabled={form.steps.length >= 30}
                  onClick={() => set('steps', [...form.steps, ''])}
                >
                  <Plus size={16} />
                  Tambah langkah
                </button>
              </>
            )}
            <div className="form-actions">
              {step === 1 && (
                <button
                  className="button outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep(0);
                    setError('');
                  }}
                >
                  Kembali
                </button>
              )}
              <button className="button primary" disabled={busy || uploading || videoUploading}>
                {busy
                  ? 'Menyimpan…'
                  : step === 0
                    ? 'Bahan & cara membuat'
                    : id
                      ? 'Simpan perubahan'
                      : 'Terbitkan resep'}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </form>
      {id && (
        <button className="delete-link" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} /> Hapus resep ini
        </button>
      )}
      <dialog ref={dialog} className="confirm-dialog" onCancel={() => setConfirmDelete(false)}>
        <h3>Hapus resep ini?</h3>
        <p>Resep, komentar, dan penandanya akan dihapus. Tindakan ini tidak dapat dibatalkan.</p>
        <div className="form-actions">
          <button
            className="button outline"
            onClick={() => setConfirmDelete(false)}
            disabled={busy}
          >
            Batal
          </button>
          <button className="button danger" onClick={remove} disabled={busy}>
            {busy ? 'Menghapus…' : 'Ya, hapus resep'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
export function ProfileEditor() {
  const { user, setUser, toast } = useApp(),
    navigate = useNavigate(),
    [form, setForm] = useState({ name: user.name, bio: user.bio, avatar: user.avatar }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/profile', { method: 'PATCH', body: form });
      setUser(data.user);
      toast('Profilmu berhasil diperbarui.');
      navigate('/profil');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="profile-editor">
      <Link className="back-link" to="/profil">
        <ArrowLeft size={17} />
        Kembali ke profil
      </Link>
      <h2>Kenalkan sosok di balik rasa.</h2>
      <p>Lengkapi profil agar komunitas bisa mengenalmu.</p>
      <Notice>{error}</Notice>
      <form onSubmit={submit}>
        <div className="profile-photo-input">
          <PhotoUpload
            value={form.avatar}
            label="Foto profil"
            onChange={(v) => setForm((f) => ({ ...f, avatar: v }))}
            onBusy={setUploading}
          />
        </div>
        <label>
          Nama lengkap
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            minLength={2}
            maxLength={60}
          />
        </label>
        <label>
          Email
          <input value={user.email} disabled />
          <small>Email digunakan untuk masuk ke akunmu.</small>
        </label>
        <label>
          Bio
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            maxLength={350}
            placeholder="Masakan favorit, cerita dapur, atau sedikit tentang dirimu…"
          />
          <small>{form.bio.length}/350</small>
        </label>
        <div className="form-actions">
          <Link className="button outline" to="/profil">
            Batal
          </Link>
          <button className="button primary" disabled={busy || uploading}>
            <Save size={17} />
            {busy ? 'Menyimpan…' : 'Simpan profil'}
          </button>
        </div>
      </form>
    </section>
  );
}
