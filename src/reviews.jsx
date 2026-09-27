import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Star, Trash2, X } from 'lucide-react';
import { api, uploadImage } from './api';
import { Avatar, Notice, useApp } from './App';

export function Rating({ average, count }) {
  return (
    <span className="rating-summary">
      <Star size={15} fill={count ? 'currentColor' : 'none'} />
      {count ? (
        <>
          <strong>{Number(average).toLocaleString('id-ID', { maximumFractionDigits: 1 })}</strong>
          <span>({count} ulasan)</span>
        </>
      ) : (
        <span>Belum ada ulasan</span>
      )}
    </span>
  );
}

export function RecipeReviews({ recipe, onChange }) {
  const { user, toast } = useApp();
  const [data, setData] = useState({ reviews: [], mine: null }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [rating, setRating] = useState(0),
    [body, setBody] = useState(''),
    [photo, setPhoto] = useState(''),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const fill = (mine) => {
    setRating(mine?.rating || 0);
    setBody(mine?.body || '');
    setPhoto(mine?.image || '');
  };
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api(`/recipes/${recipe.id}/reviews`)
      .then((d) => {
        if (live) {
          setData(d);
          fill(d.mine);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [recipe.id, user?.id]);
  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) {
      setError('Foto maksimal 5 MB.');
      return;
    }
    setUploading(true);
    try {
      setPhoto((await uploadImage(file)).path);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (uploading || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/recipes/${recipe.id}/review`, {
        method: 'PUT',
        body: { rating, body, image: photo },
      });
      onChange(result.recipe);
      const next = await api(`/recipes/${recipe.id}/reviews`);
      setData(next);
      fill(next.mine);
      toast('Ulasanmu berhasil disimpan.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/recipes/${recipe.id}/review`, { method: 'DELETE' });
      onChange(result.recipe);
      const next = await api(`/recipes/${recipe.id}/reviews`);
      setData(next);
      fill(null);
      setConfirmDelete(false);
      toast('Ulasanmu sudah dihapus.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="reviews-section" id="ulasan" aria-labelledby="reviews-heading">
      <div className="section-heading">
        <div>
          <span className="story-kicker">SUDAH DICOBA DI DAPUR</span>
          <h3 id="reviews-heading">Rasa menurut mereka.</h3>
        </div>
        <Rating average={recipe.rating_average} count={recipe.review_count} />
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <p role="status">Menyiapkan ulasan…</p>
      ) : (
        <div className="reviews-layout">
          <div className="review-composer">
            {!user ? (
              <div className="review-invitation">
                <Camera size={26} />
                <h4>Sudah mencoba resep ini?</h4>
                <p>Bagikan penilaian dan foto hasil masakanmu.</p>
                <Link
                  className="button dark small"
                  to="/masuk"
                  state={{ from: `/resep/${recipe.id}` }}
                >
                  Masuk untuk mengulas
                </Link>
              </div>
            ) : user.id === recipe.author_id ? (
              <div className="review-invitation">
                <ChefMessage />
              </div>
            ) : (
              <form onSubmit={save}>
                <h4>{data.mine ? 'Perbarui ulasanmu' : 'Bagaimana hasil masakanmu?'}</h4>
                <fieldset className="star-picker" disabled={busy || uploading}>
                  <legend>Penilaianmu</legend>
                  <div>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} title={`${n} bintang`}>
                        <input
                          type="radio"
                          name="rating"
                          value={n}
                          required
                          checked={rating === n}
                          onChange={() => setRating(n)}
                        />
                        <Star size={26} fill={rating >= n ? 'currentColor' : 'none'} />
                        <span className="sr-only">{n} bintang</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label htmlFor="review-body">Cerita dari dapurmu</label>
                <textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Bagaimana rasanya? Ada tips untuk yang ingin mencoba?"
                  minLength={2}
                  maxLength={1200}
                  required
                  disabled={busy}
                />
                {photo && (
                  <div className="review-photo-preview">
                    <img src={photo} alt="Pratinjau foto hasil masakan" />
                    <button
                      type="button"
                      className="icon-button"
                      disabled={busy || uploading}
                      onClick={() => setPhoto('')}
                      aria-label="Lepaskan foto ulasan"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                <label className="review-photo-picker">
                  <Camera size={17} />
                  {uploading
                    ? 'Mengunggah foto…'
                    : photo
                      ? 'Ganti foto hasil masakan'
                      : 'Tambahkan foto hasil masakan'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={choose}
                    aria-label="Foto hasil masakan"
                    disabled={busy || uploading}
                  />
                </label>
                <small>Opsional · JPG, PNG, WebP · maksimal 5 MB</small>
                <div className="review-form-actions">
                  <button className="button primary small" disabled={busy || uploading || !rating}>
                    {busy ? 'Menyimpan…' : data.mine ? 'Simpan ulasan' : 'Kirim ulasan'}
                  </button>
                  {data.mine && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy || uploading}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={14} /> Hapus ulasan
                    </button>
                  )}
                </div>
                {confirmDelete && (
                  <div className="review-delete-confirm">
                    <p>Hapus ulasan dan penilaianmu dari resep ini?</p>
                    <button
                      type="button"
                      className="button danger small"
                      disabled={busy}
                      onClick={remove}
                    >
                      Ya, hapus ulasan
                    </button>
                    <button
                      type="button"
                      className="button outline small"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Batalkan
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
          <div className="review-list">
            {!data.reviews.length ? (
              <div className="review-empty">
                <Star size={30} />
                <h4>Setiap percobaan punya cerita.</h4>
                <p>
                  Belum ada ulasan. Jadilah yang pertama membagikan pengalaman mencoba resep ini.
                </p>
              </div>
            ) : (
              <>
                {data.reviews.map((r) => (
                  <article className="review-entry" key={r.user_id}>
                    <header>
                      <Avatar user={r} />
                      <div>
                        <strong>
                          {r.name}
                          {r.user_id === user?.id ? ' (kamu)' : ''}
                        </strong>
                        <time dateTime={r.updated_at}>
                          {new Date(r.updated_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                      </div>
                      <span className="review-stars" aria-label={`${r.rating} dari 5 bintang`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={13} fill={i < r.rating ? 'currentColor' : 'none'} />
                        ))}
                      </span>
                    </header>
                    <p>{r.body}</p>
                    {r.image && (
                      <a
                        href={r.image}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={'Lihat foto hasil masakan ' + r.name}
                      >
                        <img
                          className="review-result"
                          src={r.image}
                          alt={'Hasil masakan ' + r.name}
                          loading="lazy"
                        />
                      </a>
                    )}
                  </article>
                ))}
                {recipe.review_count > 50 && (
                  <small>Menampilkan 50 ulasan terbaru dari {recipe.review_count} ulasan.</small>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function ChefMessage() {
  return (
    <>
      <Star size={26} />
      <h4>Cerita dari yang mencoba.</h4>
      <p>
        Penilaian diberikan oleh pengguna lain. Kamu tetap bisa berdiskusi dan menjawab pertanyaan
        di bagian komentar.
      </p>
    </>
  );
}
