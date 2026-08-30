import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Наши размеры шрифта (text-title, text-body…) — свои ключи, а не
 * стандартные tailwind. Без этой настройки tailwind-merge принимает их
 * за цвет текста и выбрасывает настоящий цвет: получается белое на белом.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['title', 'display', 'headline', 'body', 'caption', 'micro'] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
