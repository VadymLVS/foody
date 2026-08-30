import type { VoiceProvider } from './index';

/**
 * Реализация для Capacitor. Подключается на этапе 2 (см. 05-store-readiness.md).
 * Пакет: @capacitor-community/speech-recognition
 *
 * Пока модуль не установлен — провайдер честно сообщает о недоступности,
 * и кнопка микрофона не отображается.
 */
export const nativeVoice: VoiceProvider = {
  id: 'native',

  async isAvailable() {
    return false; // TODO(этап 2): SpeechRecognition.available()
  },

  async start() {
    throw new Error('voice_unavailable');
  },

  stop() {},
};
