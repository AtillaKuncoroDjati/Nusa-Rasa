import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

export function CookingMode({ recipe, onClose }) {
  const dialog = useRef(null);
  const finishedHeading = useRef(null);
  const [step, setStep] = useState(0),
    [finished, setFinished] = useState(false),
    [completed, setCompleted] = useState([]);
  const [minutes, setMinutes] = useState('5'),
    [remaining, setRemaining] = useState(0),
    [deadline, setDeadline] = useState(null),
    [timerStarted, setTimerStarted] = useState(false);
  useEffect(() => {
    if (finished) finishedHeading.current?.focus();
  }, [finished]);
  useEffect(() => {
    const el = dialog.current,
      overflow = document.body.style.overflow;
    el.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      el.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setDeadline(null);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const resetTimer = () => {
    setDeadline(null);
    setRemaining(0);
    setTimerStarted(false);
  };
  const validMinutes =
    Number.isInteger(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 180;
  const startTimer = () => {
    if (!validMinutes) return;
    const seconds = remaining || Number(minutes) * 60;
    setRemaining(seconds);
    setTimerStarted(true);
    setDeadline(Date.now() + seconds * 1000);
  };
  const advance = () => {
    setCompleted((done) => (done.includes(step) ? done : [...done, step]));
    if (step === recipe.steps.length - 1) {
      setFinished(true);
      resetTimer();
    } else setStep((s) => s + 1);
  };
  return (
    <dialog
      className="cooking-dialog"
      ref={dialog}
      aria-labelledby="cooking-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="cooking-header">
        <div>
          <span className="story-kicker">
            <ChefHat size={17} /> MODE MEMASAK
          </span>
          <h2 id="cooking-title">{recipe.title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Tutup mode memasak">
          <X />
        </button>
      </header>
      {finished ? (
        <div className="cooking-finished">
          <span>
            <Check size={36} />
          </span>
          <h3 ref={finishedHeading} tabIndex={-1}>
            Selamat menikmati!
          </h3>
          <p>
            Semua langkah sudah selesai. Bagikan hasil masakan dan pengalamanmu di bagian ulasan
            resep.
          </p>
          <button className="button primary" onClick={onClose}>
            Kembali ke resep <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="cooking-progress">
            <span>
              {completed.length} dari {recipe.steps.length} langkah selesai
            </span>
            <progress
              value={completed.length}
              max={recipe.steps.length}
              aria-label="Langkah selesai"
            />
          </div>
          <div className="cooking-body">
            <section className="cooking-step" aria-live="polite" aria-atomic="true">
              <span className="step-number">
                LANGKAH {String(step + 1).padStart(2, '0')} /{' '}
                {String(recipe.steps.length).padStart(2, '0')}
              </span>
              <h3>{recipe.steps[step]}</h3>
              <div className="cooking-navigation">
                <button
                  className="button outline"
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ArrowLeft size={18} /> Sebelumnya
                </button>
                <button className="button primary" onClick={advance}>
                  {step === recipe.steps.length - 1 ? 'Selesai memasak' : 'Selesai & lanjut'}{' '}
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
            <aside className="cooking-tools">
              <div className="kitchen-timer">
                <h3>
                  <Clock size={18} /> Timer dapur
                </h3>
                <p>Timer tetap berjalan saat berpindah langkah.</p>
                <output aria-label="Sisa waktu" aria-live="off">
                  {String(Math.floor(remaining / 60)).padStart(2, '0')}:
                  {String(remaining % 60).padStart(2, '0')}
                </output>
                <label>
                  Durasi (menit)
                  <input
                    type="number"
                    min="1"
                    max="180"
                    step="1"
                    value={minutes}
                    disabled={Boolean(deadline || remaining)}
                    onChange={(e) => setMinutes(e.target.value)}
                  />
                </label>
                <div className="timer-actions">
                  {deadline ? (
                    <button
                      className="button dark small"
                      onClick={() => {
                        setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
                        setDeadline(null);
                      }}
                    >
                      <Pause size={15} /> Jeda
                    </button>
                  ) : (
                    <button
                      className="button dark small"
                      disabled={!validMinutes}
                      onClick={startTimer}
                    >
                      <Play size={15} />
                      {remaining ? 'Lanjutkan timer' : 'Mulai timer'}
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Atur ulang timer"
                    onClick={resetTimer}
                  >
                    <RotateCcw size={17} />
                  </button>
                </div>
                <div role="status" className="timer-status">
                  {timerStarted && !deadline && remaining === 0
                    ? 'Waktu habis. Periksa masakanmu.'
                    : ''}
                </div>
                <small>Timer berhenti ketika mode ini ditutup atau memasak selesai.</small>
              </div>
              <details className="cooking-ingredients">
                <summary>Lihat bahan · {recipe.servings} porsi</summary>
                <ul>
                  {recipe.ingredients.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            </aside>
          </div>
        </>
      )}
    </dialog>
  );
}
