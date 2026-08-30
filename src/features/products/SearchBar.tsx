import { useEffect, useState } from 'react';
import { Mic, Search, X } from 'lucide-react';
import { Input } from '@/shared/ui';
import { voice } from '@/shared/lib/voice';
import { cn } from '@/shared/lib/cn';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const [voiceReady, setVoiceReady] = useState(false);
  const [listening, setListening] = useState(false);

  // Кнопка микрофона появляется, только если распознавание реально работает.
  // Показывать неработающую кнопку хуже, чем не показывать никакой (D-013).
  useEffect(() => {
    let alive = true;
    void voice.isAvailable().then((ok) => {
      if (alive) setVoiceReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const listen = async () => {
    setListening(true);
    try {
      const transcript = await voice.start('ru-RU');
      if (transcript) onChange(transcript);
    } catch {
      // Пользователь отменил или отказал в доступе к микрофону — молча выходим.
    } finally {
      setListening(false);
    }
  };

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Найти продукт…"
      inputMode="search"
      iconLeft={<Search className="h-5 w-5" />}
      iconRight={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Очистить поиск"
            className="flex h-8 w-8 items-center justify-center text-text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        ) : voiceReady ? (
          <button
            type="button"
            onClick={listen}
            aria-label="Найти голосом"
            className={cn(
              'flex h-8 w-8 items-center justify-center',
              listening ? 'text-accent' : 'text-text-muted',
            )}
          >
            <Mic className={cn('h-5 w-5', listening && 'animate-pulse')} />
          </button>
        ) : null
      }
    />
  );
}
