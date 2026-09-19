import { useEffect, useState } from 'react';
import { Mic, Search, Square, X } from 'lucide-react';
import { voice } from '@/shared/lib/voice';
import { t } from '@/shared/lib/i18n';

/** Поиск без рамки — только подчёркивание, как в референсе. */
export function SearchField({
  value, onChange, placeholder, withVoice = true,
}: { value: string; onChange: (v: string) => void; placeholder: string; withVoice?: boolean }) {
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!withVoice) return;
    let alive = true;
    void voice.isAvailable().then((ok) => alive && setVoiceReady(ok));
    return () => { alive = false; };
  }, [withVoice]);

  // «Стоп» завершает запись; распознанное до этого момента всё равно придёт в listen()
  const stop = () => voice.stop();

  const listen = async () => {
    setListening(true);
    try {
      const text = await voice.start('ru-RU');
      if (text) onChange(text);
    } catch {
      /* отказ в доступе или отмена */
    } finally {
      setListening(false);
    }
  };

  /*
   * Во время записи поле уступает место заметному индикатору (backlog п. 21):
   * раньше менялся только цвет иконки, и было непонятно, идёт ли запись.
   */
  if (listening) {
    return (
      <div className="flex items-center gap-2 border-b border-accent pl-0.5" role="status" aria-live="polite">
        <span className="relative flex h-[15px] w-[15px] shrink-0 items-center justify-center">
          <span className="absolute h-full w-full animate-ping rounded-full bg-accent/60" />
          <span className="relative h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="flex h-11 min-w-0 flex-1 items-center gap-2 text-body text-accent">
          {t('voice.listening')}
          <span className="flex h-4 items-end gap-[3px]" aria-hidden>
            {[0, 150, 300, 450].map((delay) => (
              <span
                key={delay}
                className="w-[3px] animate-voice-bar rounded-full bg-accent"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </span>
        <button
          type="button"
          onClick={stop}
          aria-label={t('voice.stop')}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption text-accent active:bg-surface"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          {t('voice.stop')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-line pl-0.5">
      <Search className="h-[15px] w-[15px] shrink-0 text-[#4A4A4A]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className="h-11 min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-[#4A4A4A]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Очистить"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-[#6E6E6E]"
        >
          <X className="h-5 w-5" />
        </button>
      ) : voiceReady ? (
        <button
          type="button"
          onClick={listen}
          aria-label="Найти голосом"
          // Зона касания 44×44, иконка 20px (backlog п. 16)
          className="flex h-11 w-11 shrink-0 items-center justify-center text-[#6E6E6E]"
        >
          <Mic className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
