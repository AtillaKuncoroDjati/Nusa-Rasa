import { useEffect, useRef, useState } from 'react';
import { Film, UploadCloud, Trash2, X } from 'lucide-react';
import { uploadVideo } from './api';

export function RecipeVideo({ src, poster, title = 'Video cara memasak' }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  return (
    <div className="recipe-video">
      <video
        key={src}
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        onError={() => setError(true)}
      >
        Browser kamu belum mendukung pemutar video.
      </video>
      {error && (
        <p className="video-error" role="alert">
          Video tidak dapat diputar di browser ini.{' '}
          <a href={src} download>
            Unduh video
          </a>{' '}
          untuk membukanya di pemutar lain.
        </p>
      )}
    </div>
  );
}

export function VideoUpload({ value, poster, onChange, onBusy, disabled = false }) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState('');
  const [filename, setFilename] = useState('');
  const controller = useRef(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!/\.(mp4|webm)$/i.test(file.name)) {
      setError('Pilih video MP4 atau WebM.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Video maksimal 50 MB.');
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    onBusy?.(true);
    setProgress(0);
    try {
      const result = await uploadVideo(file, { signal: current.signal, onProgress: setProgress });
      onChange(result.path);
      setFilename(file.name);
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setBusy(false);
        onBusy?.(false);
      }
    }
  }
  return (
    <section className="video-upload" aria-label="Video resep">
      <div className="video-upload-heading">
        <Film size={20} />
        <div>
          <h3>Video cara memasak</h3>
          <span>Opsional · MP4 atau WebM · maksimal 50 MB</span>
        </div>
      </div>
      {value ? (
        <RecipeVideo src={value} poster={poster} title="Pratinjau video resep" />
      ) : (
        <p>Tunjukkan proses memasakmu, dari persiapan sampai siap disajikan.</p>
      )}
      {filename && <p className="video-filename">{filename}</p>}
      {busy && (
        <div className="video-progress" role="status">
          <span>{progress === 100 ? 'Memeriksa video…' : `Mengunggah video… ${progress}%`}</span>
          <progress max="100" value={progress} aria-label="Progres unggah video" />
        </div>
      )}
      <div className="video-upload-actions">
        <label
          className={
            'button outline small video-file-button ' + (busy || disabled ? 'is-disabled' : '')
          }
        >
          <UploadCloud size={16} />
          {value ? 'Ganti video' : 'Pilih video'}
          <input
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm"
            aria-label={value ? 'Ganti video resep' : 'Pilih video resep'}
            disabled={busy || disabled}
            onChange={choose}
          />
        </label>
        {busy ? (
          <button
            type="button"
            className="button outline small"
            onClick={() => controller.current?.abort()}
          >
            <X size={15} />
            Batalkan
          </button>
        ) : (
          value && (
            <button
              type="button"
              className="video-remove"
              disabled={disabled}
              onClick={() => {
                onChange('');
                setFilename('');
                setError('');
              }}
            >
              <Trash2 size={15} />
              Hapus dari resep
            </button>
          )
        )}
      </div>
      <small>MP4 H.264 atau WebM VP8/VP9. Video tampil setelah resep disimpan.</small>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
