import { useEffect, useState } from 'react';
import { Mic, Search, X } from 'lucide-react';
import { voice } from '@/shared/lib/voice';
import { cn } from '@/shared/lib/cn';

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

  return (
    <div className="flex items-center gap-2 border-b border-line px-0.5 pb-2">
      <Search className="h-[15px] w-[15px] shrink-0 text-[#4A4A4A]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-[#4A4A4A]"
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Очистить" className="text-[#4A4A4A]">
          <X className="h-[15px] w-[15px]" />
        </button>
      ) : voiceReady ? (
        <button
          type="button"
          onClick={listen}
          aria-label="Найти голосом"
          className={cn(listening ? 'text-accent' : 'text-[#4A4A4A]')}
        >
          <Mic className={cn('h-[15px] w-[15px]', listening && 'animate-pulse')} />
        </button>
      ) : null}
    </div>
  );
}
