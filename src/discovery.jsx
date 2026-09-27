import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Clock, Leaf, MapPin, Search } from 'lucide-react';

export function HomeIntro({ recipes }) {
  const featured = recipes.find((r) => r.id === 1) || recipes[0];
  if (!featured) return null;
  return (
    <>
      <section className="home-story" aria-label="Inspirasi dari dapur Nusantara">
        <div className="home-story-copy">
          <span className="story-kicker">
            <Leaf size={16} /> RASA LOKAL, CERITA BERSAMA
          </span>
          <h2>
            Masak sederhana.
            <br />
            Rasanya <em>istimewa.</em>
          </h2>
          <p>
            Temukan resep dari berbagai daerah, coba di dapurmu, dan bagikan cerita di balik setiap
            sajian.
          </p>
          <Link className="button dark" to="/jelajahi">
            Temukan inspirasi <ArrowRight size={17} />
          </Link>
          <span className="story-signature">Dari dapur kita, untuk semua.</span>
        </div>
        <Link
          to={'/resep/' + featured.id}
          className="featured-recipe"
          aria-label={'Inspirasi pilihan: ' + featured.title}
        >
          <img src={featured.image} alt={featured.title} fetchPriority="high" />
          <span className="featured-label">INSPIRASI PILIHAN</span>
          <div className="featured-caption">
            <div>
              <span>
                <MapPin size={13} />
                {featured.region} <span>·</span> {featured.minutes} menit
              </span>
              <h3>{featured.title}</h3>
            </div>
            <span className="featured-arrow">
              <ArrowUpRight />
            </span>
          </div>
        </Link>
      </section>
      <div className="discovery-shortcuts">
        <Link to="/jelajahi?menit=30">
          <span className="shortcut-icon">
            <Clock />
          </span>
          <div>
            <strong>Sedikit waktu, banyak rasa.</strong>
            <span>Temukan masakan 30 menit atau kurang</span>
          </div>
          <ArrowUpRight size={20} />
        </Link>
        <Link to="/cari">
          <span className="shortcut-icon green">
            <Leaf />
          </span>
          <div>
            <strong>Mulai dari isi dapurmu.</strong>
            <span>Cari resep dari bahan yang sudah ada</span>
          </div>
          <ArrowUpRight size={20} />
        </Link>
      </div>
    </>
  );
}

export function RecipeFilters({ params, setParams }) {
  const ingredients = params.get('bahan') || '';
  return (
    <form
      className="discovery-filter"
      key={params.toString()}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget),
          next = new URLSearchParams(params);
        for (const name of ['q', 'bahan', 'menit']) {
          const value = String(data.get(name) || '').trim();
          value ? next.set(name, value) : next.delete(name);
        }
        setParams(next);
      }}
    >
      <div className="filter-fields">
        <label>
          <span>Mau masak apa?</span>
          <div className="search-input">
            <Search size={17} />
            <input
              name="q"
              defaultValue={params.get('q') || ''}
              maxLength={100}
              placeholder="Nama resep atau daerah"
            />
          </div>
        </label>
        <label>
          <span>Bahan yang tersedia</span>
          <input
            name="bahan"
            defaultValue={ingredients}
            maxLength={240}
            placeholder="Contoh: ayam, telur"
            aria-describedby="ingredients-hint"
          />
        </label>
        <label>
          <span>Waktu memasak</span>
          <select name="menit" defaultValue={params.get('menit') || ''}>
            <option value="">Semua durasi</option>
            <option value="15">Maks. 15 menit</option>
            <option value="30">Maks. 30 menit</option>
            <option value="60">Maks. 1 jam</option>
            <option value="120">Maks. 2 jam</option>
          </select>
        </label>
        <button className="button primary">
          <Search size={17} /> Cari resep
        </button>
      </div>
      <div className="filter-helper">
        <small id="ingredients-hint">
          Pisahkan bahan dengan koma, maksimal 6. Hasil memuat semua bahan yang dicari; resep dapat
          memerlukan bahan lain.
        </small>
        {Boolean(params.get('q') || ingredients || params.get('menit') || params.get('daerah')) && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              const next = new URLSearchParams(params);
              ['q', 'bahan', 'menit', 'daerah'].forEach((k) => next.delete(k));
              setParams(next);
            }}
          >
            Hapus filter
          </button>
        )}
      </div>
    </form>
  );
}

export function RecipeSkeleton() {
  return (
    <div role="status" aria-label="Memuat resep" className="recipe-grid skeleton-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="recipe-skeleton" aria-hidden="true">
          <div />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
