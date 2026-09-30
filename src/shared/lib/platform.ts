/**
 * Определение среды выполнения.
 *
 * Важно: проверять платформу, а не наличие API. В WKWebView объект
 * webkitSpeechRecognition присутствует, но не работает — feature detection
 * даёт ложноположительный результат (D-013).
 */

export const isNative = (): boolean =>
  typeof window !== 'undefined' && 'Capacitor' in window;

const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent);

/** iOS-браузер, который НЕ является полноценным Safari (то есть webview). */
export const isIOSWebView = (): boolean => {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  return !/Safari/.test(ua) || /(FBAN|FBAV|Instagram|Line\/)/.test(ua);
};
