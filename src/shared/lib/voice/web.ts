import type { VoiceProvider } from './index';

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const getConstructor = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | null;
};

let current: SpeechRecognitionLike | null = null;

export const webVoice: VoiceProvider = {
  id: 'web',

  async isAvailable() {
    return getConstructor() !== null;
  },

  start(lang = 'ru-RU') {
    const Ctor = getConstructor();
    if (!Ctor) return Promise.reject(new Error('voice_unavailable'));

    return new Promise<string>((resolve, reject) => {
      const recognition = new Ctor();
      current = recognition;
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let settled = false;

      recognition.onresult = (e) => {
        settled = true;
        resolve(e.results[0]?.[0]?.transcript ?? '');
      };
      recognition.onerror = (e) => {
        settled = true;
        reject(new Error(e.error));
      };
      recognition.onend = () => {
        current = null;
        if (!settled) resolve('');
      };

      recognition.start();
    });
  },

  stop() {
    current?.stop();
    current = null;
  },
};
