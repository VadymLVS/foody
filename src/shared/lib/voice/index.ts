/**
 * Голосовой ввод. См. D-013.
 *
 * Apple не включила Web Speech API в WKWebView, при этом объект
 * webkitSpeechRecognition в window присутствует. Поэтому выбор
 * реализации идёт по платформе, а не по наличию API.
 */
import { isNative, isIOSWebView } from '@/shared/lib/platform';
import { webVoice } from './web';
import { nativeVoice } from './native';

export interface VoiceProvider {
  readonly id: 'web' | 'native' | 'none';
  isAvailable(): Promise<boolean>;
  start(lang?: string): Promise<string>;
  stop(): void;
}

const noVoice: VoiceProvider = {
  id: 'none',
  isAvailable: async () => false,
  start: async () => { throw new Error('voice_unavailable'); },
  stop: () => {},
};

export const voice: VoiceProvider = isNative()
  ? nativeVoice
  : isIOSWebView()
    ? noVoice          // webview без Capacitor — распознавания не будет
    : webVoice;
