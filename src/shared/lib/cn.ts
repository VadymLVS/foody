import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Размеры шрифта у нас свои: text-title, text-body, text-micro и так далее.
 * tailwind-merge про них не знает и, видя префикс text-, считает их цветом
 * текста — а значит выбрасывает настоящий цвет как перебитый.
 *
 * В кнопке классы идут в порядке «цвет, потом размер», поэтому text-black
 * терялся и получался белый текст на белой кнопке.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['title', 'display', 'headline', 'body', 'caption', 'micro'] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
