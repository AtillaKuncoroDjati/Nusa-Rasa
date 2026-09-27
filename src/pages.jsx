import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Heart,
  Bookmark,
  Clock,
  ArrowUpRight,
  ArrowLeft,
  Users,
  MapPin,
  Share2,
  Check,
  ChefHat,
  Flame,
  Search,
  Bell,
  CheckCheck,
  Pencil,
  MessageCircle,
  ArrowRight,
  Utensils,
  Play,
} from 'lucide-react';
import { api } from './api';
import { useApp, Avatar, Spinner, Notice, Empty } from './App';
import { RecipeVideo } from './video';
import { HomeIntro, RecipeFilters, RecipeSkeleton } from './discovery';
import { CookingMode } from './cooking';
import { RecipeReviews, Rating } from './reviews';

export function RecipeCard({ recipe, onChange }) {
  const { user, toast } = useApp(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false);
  async function toggle(type) {
    if (!user) {
      navigate('/masuk', { state: { from: location.pathname + location.search } });
      return;
    }
    setBusy(true);
    try {
      const { recipe: r } = await api(`/recipes/${recipe.id}/${type}`, {
        method: 'PUT',
        body: { active: type === 'like' ? !recipe.liked : !recipe.saved },
      });
      onChange(r);
      if (type === 'bookmark')
        toast(r.saved ? 'Resep ditambahkan ke penanda.' : 'Resep dihapus dari penanda.');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="recipe-card">
      <div className="recipe-cover">
        <Link
          to={'/resep/' + recipe.id}
          className="cover-link"
          aria-label={'Lihat resep ' + recipe.title}
        >
          <img src={recipe.image} alt={recipe.title} loading="lazy" />
          <span className="cover-shade" />
          <span className="read-recipe">
            {recipe.video ? <Play size={22} /> : <Utensils size={22} />}
            <span>Lihat resep</span>
          </span>
        </Link>
        <span className="card-author">
          <Avatar user={{ name: recipe.author_name, avatar: recipe.author_avatar }} size="tiny" />
          {recipe.author_name}
        </span>
        <button
          aria-label={(recipe.saved ? 'Hapus penanda ' : 'Simpan resep ') + recipe.title}
          aria-pressed={recipe.saved}
          disabled={busy}
          className={'save-button ' + (recipe.saved ? 'active' : '')}
          onClick={() => toggle('bookmark')}
        >
          <Bookmark size={20} fill={recipe.saved ? 'currentColor' : 'none'} />
        </button>
        <span className="region-label">
          <MapPin size={12} />
          {recipe.region}
        </span>
        {recipe.video && (
          <span className="video-badge">
            <Play size={12} />
            Video
          </span>
        )}
      </div>
      <div className="card-body">
        <button
          className={'like-button ' + (recipe.liked ? 'active' : '')}
          aria-label={(recipe.liked ? 'Batal suka ' : 'Sukai ') + recipe.title}
          aria-pressed={recipe.liked}
          disabled={busy}
          onClick={() => toggle('like')}
        >
          <span>
            <Heart size={21} fill={recipe.liked ? 'currentColor' : 'none'} />
          </span>
          <small>{recipe.like_count}</small>
        </button>
        <div>
          <Link className="card-title" to={'/resep/' + recipe.id}>
            <h2>{recipe.title}</h2>
            <ArrowUpRight size={18} />
          </Link>
          <p>{recipe.description}</p>
          <div className="card-meta">
            <span>
              <Clock size={13} />
              {recipe.minutes} menit
            </span>
            <i />
            <span>{recipe.servings} porsi</span>
            <i />
            <span>{recipe.ingredients.length} bahan</span>
          </div>
          <Rating average={recipe.rating_average} count={recipe.review_count} />
        </div>
      </div>
    </article>
  );
}

export function RecipeList({ kind = 'home' }) {
  const { user, config } = useApp(),
    [params, setParams] = useSearchParams(),
    [recipes, setRecipes] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const q = params.get('q') || '',
    ingredients = params.get('bahan') || '',
    maxMinutes = params.get('menit') || '',
    region = params.get('daerah') || '',
    sort = params.get('urut') || 'popular';
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      q,
      ingredients,
      region,
      sort: sort === 'newest' ? 'newest' : 'popular',
      scope: kind === 'saved' ? 'saved' : kind === 'mine' ? 'mine' : 'all',
    });
    if (maxMinutes) query.set('maxMinutes', maxMinutes);
    api('/recipes?' + query)
      .then((d) => {
        if (live) setRecipes(d.recipes);
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
  }, [q, ingredients, maxMinutes, region, sort, kind, user?.id]);
  const setFilter = (name, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    setParams(next);
  };
  const update = (r) =>
    setRecipes((current) =>
      current
        .map((old) => (old.id === r.id ? r : old))
        .filter((old) => kind !== 'saved' || old.saved),
    );
  return (
    <section className="list-page">
      {kind === 'home' && !loading && !error && !q && !ingredients && !region && !maxMinutes && (
        <HomeIntro recipes={recipes} />
      )}
      <div className="discovery-heading">
        <div>
          <span className="story-kicker">JELAJAHI RASA</span>
          <h2>
            {kind === 'saved'
              ? 'Untuk dimasak nanti.'
              : kind === 'mine'
                ? 'Kreasi dari dapurmu.'
                : 'Resep untuk setiap hari.'}
          </h2>
        </div>
        <span className="discovery-note">
          <MapPin size={15} /> Cerita dari berbagai daerah
        </span>
      </div>
      <RecipeFilters params={params} setParams={setParams} />
      <div className="list-intro">
        <p>
          {kind === 'saved'
            ? 'Koleksi rasa pilihanmu. Siap dimasak kapan saja.'
            : kind === 'mine'
              ? 'Cerita dan kreasi dari dapurmu sendiri.'
              : kind === 'explore'
                ? 'Dari Sabang sampai Merauke, selalu ada rasa baru untuk dicoba.'
                : q
                  ? `Hasil pencarian untuk “${q}”`
                  : 'Inspirasi masak hari ini, dari dapur-dapur di seluruh Indonesia.'}
        </p>
        <label className="sort-label">
          <span>Urutkan</span>
          <select
            aria-label="Urutkan resep"
            value={sort}
            onChange={(e) => setFilter('urut', e.target.value)}
          >
            <option value="popular">Paling disukai</option>
            <option value="newest">Terbaru</option>
          </select>
        </label>
      </div>
      <div className="region-tabs" aria-label="Filter daerah">
        <button
          className={!region ? 'selected' : ''}
          onClick={() => setFilter('daerah', '')}
          aria-pressed={!region}
        >
          Semua rasa
        </button>
        {config.regions.map((r) => (
          <button
            key={r}
            className={region === r ? 'selected' : ''}
            onClick={() => setFilter('daerah', r)}
            aria-pressed={region === r}
          >
            {r}
          </button>
        ))}
      </div>
      <Notice>{error}</Notice>
      {loading ? (
        <RecipeSkeleton />
      ) : !error && recipes.length ? (
        <>
          <div className="recipe-grid">
            {recipes.map((r) => (
              <RecipeCard key={r.id} recipe={r} onChange={update} />
            ))}
          </div>
          <div className="list-end">
            <span />
            <p>
              {recipes.length} resep, segudang cerita.
              <br />
              <strong>Resep berikutnya bisa jadi milikmu.</strong>
            </p>
            <span />
          </div>
        </>
      ) : (
        !error && (
          <Empty
            title={
              kind === 'saved'
                ? 'Belum ada resep tersimpan.'
                : kind === 'mine'
                  ? 'Resep pertamamu dimulai di sini.'
                  : 'Belum ketemu resepnya.'
            }
            action={
              <Link className="button primary" to={kind === 'mine' ? '/unggah' : '/jelajahi'}>
                {kind === 'mine' ? 'Bagikan resep' : 'Jelajahi resep'} <ArrowRight size={17} />
              </Link>
            }
          >
            {kind === 'saved'
              ? 'Ketuk ikon penanda pada resep yang ingin kamu coba nanti.'
              : 'Coba daerah atau kata kunci lain, atau bagikan resep versimu sendiri.'}
          </Empty>
        )
      )}
    </section>
  );
}

export function RecipeDetail() {
  const { id } = useParams(),
    { user, toast } = useApp(),
    navigate = useNavigate(),
    [recipe, setRecipe] = useState(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState('ingredients'),
    [done, setDone] = useState([]),
    [comments, setComments] = useState([]),
    [cooking, setCooking] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setRecipe(null);
    setError('');
    setDone([]);
    setTab('ingredients');
    Promise.all([api('/recipes/' + id), api('/recipes/' + id + '/comments')])
      .then(([r, c]) => {
        if (live) {
          setRecipe(r.recipe);
          setComments(c.comments);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, user?.id]);
  const toggle = async (type) => {
    if (!user) {
      navigate('/masuk', { state: { from: '/resep/' + id } });
      return;
    }
    setBusy(true);
    try {
      const d = await api(`/recipes/${id}/${type}`, {
        method: 'PUT',
        body: { active: type === 'like' ? !recipe.liked : !recipe.saved },
      });
      setRecipe(d.recipe);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Tautan resep berhasil disalin.');
    } catch {
      toast('Salin alamat halaman ini untuk membagikan resep.');
    }
  };
  const comment = async (e) => {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    try {
      await api(`/recipes/${id}/comments`, {
        method: 'POST',
        body: { body: new FormData(form).get('body') },
      });
      const data = await api(`/recipes/${id}/comments`);
      setComments(data.comments);
      form.reset();
      toast('Komentarmu sudah ditambahkan.');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (error) return <Notice>{error}</Notice>;
  if (!recipe) return <Spinner />;
  const entries = tab === 'ingredients' ? recipe.ingredients : recipe.steps;
  return (
    <article className="detail-page">
      <Link to="/jelajahi" className="back-link">
        <ArrowLeft size={17} /> Jelajahi resep
      </Link>
      <div className="detail-heading">
        <div>
          <span className="tag">
            <MapPin size={13} />
            {recipe.region}
          </span>
          <h2>{recipe.title}</h2>
          <a href="#ulasan" className="detail-rating-link">
            <Rating average={recipe.rating_average} count={recipe.review_count} />
          </a>
        </div>
        <button className="button outline small" onClick={share}>
          <Share2 size={17} /> Bagikan
        </button>
      </div>
      <div className="detail-grid">
        <div>
          <img className="detail-photo" src={recipe.image} alt={recipe.title} />
          {recipe.video && (
            <section className="detail-video">
              <h3>
                <Play size={18} />
                Video cara memasak
              </h3>
              <RecipeVideo
                src={recipe.video}
                poster={recipe.image}
                title={'Video cara membuat ' + recipe.title}
              />
            </section>
          )}
          <div className="detail-author">
            <Avatar user={{ name: recipe.author_name, avatar: recipe.author_avatar }} />
            <div>
              <small>DARI DAPUR</small>
              <strong>{recipe.author_name}</strong>
            </div>
            {user?.id === recipe.author_id && (
              <Link className="button outline small" to={`/resep/${id}/edit`}>
                <Pencil size={15} />
                Edit resep
              </Link>
            )}
          </div>
          <p className="detail-description">{recipe.description}</p>
          <div className="detail-actions">
            <button
              className={'button outline ' + (recipe.liked ? 'is-liked' : '')}
              disabled={busy}
              onClick={() => toggle('like')}
              aria-pressed={recipe.liked}
            >
              <Heart size={18} fill={recipe.liked ? 'currentColor' : 'none'} />
              {recipe.like_count} suka
            </button>
            <button
              className={'button ' + (recipe.saved ? 'dark' : 'primary')}
              disabled={busy}
              onClick={() => toggle('bookmark')}
              aria-pressed={recipe.saved}
            >
              <Bookmark size={18} fill={recipe.saved ? 'currentColor' : 'none'} />
              {recipe.saved ? 'Tersimpan' : 'Simpan resep'}
            </button>
          </div>
        </div>
        <div className="recipe-instructions">
          <button className="button dark start-cooking" onClick={() => setCooking(true)}>
            <ChefHat size={20} />
            <span>
              Mulai mode memasak<small>Satu langkah, satu waktu.</small>
            </span>
            <ArrowRight size={18} />
          </button>
          <div className="recipe-facts">
            <div>
              <Clock />
              <span>
                Waktu memasak<strong>{recipe.minutes} menit</strong>
              </span>
            </div>
            <div>
              <Users />
              <span>
                Untuk disajikan<strong>{recipe.servings} porsi</strong>
              </span>
            </div>
          </div>
          <div className="detail-tabs" role="tablist" aria-label="Panduan memasak">
            <button
              role="tab"
              aria-selected={tab === 'ingredients'}
              onClick={() => setTab('ingredients')}
              className={tab === 'ingredients' ? 'active' : ''}
            >
              Bahan-bahan
            </button>
            <button
              role="tab"
              aria-selected={tab === 'steps'}
              onClick={() => setTab('steps')}
              className={tab === 'steps' ? 'active' : ''}
            >
              Cara membuat
            </button>
          </div>
          <div className="instruction-title">
            <h3>{tab === 'ingredients' ? 'Siapkan bahanmu' : 'Saatnya memasak'}</h3>
            <p>
              {tab === 'ingredients'
                ? 'Centang bahan yang sudah siap.'
                : 'Ikuti langkahnya, satu rasa setiap waktu.'}
            </p>
          </div>
          <div role="tabpanel">
            {entries.map((entry, i) => {
              const key = tab + i,
                checked = done.includes(key);
              return (
                <label className={'instruction ' + (checked ? 'checked' : '')} key={key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDone((d) => (checked ? d.filter((k) => k !== key) : [...d, key]))
                    }
                  />
                  <span className="instruction-check">
                    {checked ? <Check size={15} /> : tab === 'steps' ? i + 1 : ''}
                  </span>
                  <span>{entry}</span>
                </label>
              );
            })}
          </div>
          <div className="cook-tip">
            <ChefHat size={24} />
            <p>
              Sentuhan terakhir selalu milikmu.
              <br />
              <strong>Sesuaikan rasa dengan seleramu.</strong>
            </p>
          </div>
        </div>
      </div>
      {cooking && <CookingMode key={recipe.id} recipe={recipe} onClose={() => setCooking(false)} />}
      <RecipeReviews
        key={`${recipe.id}-${user?.id || 'guest'}`}
        recipe={recipe}
        onChange={setRecipe}
      />
      <section className="comments">
        <div className="section-heading">
          <h3>
            Cerita dari dapur <span>{comments.length}</span>
          </h3>
          <MessageCircle size={21} />
        </div>
        {user ? (
          <form onSubmit={comment}>
            <label htmlFor="comment">Sudah mencoba resep ini? Bagikan ceritamu.</label>
            <textarea
              id="comment"
              name="body"
              placeholder="Tips, pertanyaan, atau hasil masakanmu…"
              required
              minLength={2}
              maxLength={1200}
            />
            <button className="button dark small" disabled={busy}>
              Kirim komentar <ArrowUpRight size={16} />
            </button>
          </form>
        ) : (
          <p>
            <Link className="text-link" to="/masuk" state={{ from: '/resep/' + id }}>
              Masuk
            </Link>{' '}
            untuk ikut berbagi cerita.
          </p>
        )}
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar user={c} />
            <div>
              <strong>{c.name}</strong>
              <small>{new Date(c.created_at).toLocaleDateString('id-ID')}</small>
              <p>{c.body}</p>
            </div>
          </div>
        ))}
      </section>
    </article>
  );
}
export function Profile() {
  const { user } = useApp();
  return (
    <>
      <section className="profile-banner">
        <span className="profile-pattern" />
        <Avatar user={user} size="large" />
        <div>
          <span className="eyebrow">CERITA DARI DAPUR</span>
          <h2>{user.name}</h2>
          <p>{user.bio || 'Setiap masakan menyimpan sebuah cerita. Bagikan ceritamu di sini.'}</p>
        </div>
        <Link to="/profil/edit" className="button outline small">
          <Pencil size={15} />
          Edit profil
        </Link>
      </section>
      <div className="section-heading">
        <h2>Resep saya</h2>
        <Link to="/unggah" className="text-link">
          Tambah resep <ArrowUpRight size={17} />
        </Link>
      </div>
      <RecipeList kind="mine" />
    </>
  );
}
export function Notifications() {
  const { toast } = useApp(),
    [items, setItems] = useState(null),
    [error, setError] = useState('');
  useEffect(() => {
    api('/notifications')
      .then((d) => setItems(d.notifications))
      .catch((e) => setError(e.message));
  }, []);
  const read = async () => {
    try {
      await api('/notifications/read', { method: 'PATCH' });
      setItems((old) => old.map((n) => ({ ...n, seen: 1 })));
      toast('Semua notifikasi ditandai telah dibaca.');
    } catch (e) {
      toast(e.message);
    }
  };
  if (error) return <Notice>{error}</Notice>;
  if (!items) return <Spinner />;
  return (
    <section className="notifications">
      <div className="section-heading">
        <p>Kabar terbaru dari komunitas dapurmu.</p>
        <button
          className="button outline small"
          onClick={read}
          disabled={!items.some((i) => !i.seen)}
        >
          <CheckCheck size={17} />
          Tandai dibaca
        </button>
      </div>
      {items.length ? (
        items.map((n) => (
          <article className={'notification ' + (!n.seen ? 'unread' : '')} key={n.id}>
            <span className="notification-icon">
              <Bell size={20} />
            </span>
            <div>
              {n.recipe_id ? (
                <Link to={'/resep/' + n.recipe_id}>{n.message}</Link>
              ) : (
                <p>{n.message}</p>
              )}
              <small>
                {new Date(n.created_at).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </small>
            </div>
            {!n.seen && <span className="unread-dot" aria-label="Belum dibaca" />}
          </article>
        ))
      ) : (
        <Empty title="Belum ada kabar baru.">Aktivitas pada resepmu akan muncul di sini.</Empty>
      )}
    </section>
  );
}
