import { useState } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Medal } from './Medal';

export interface DishTileData {
  id: string;
  name: string;
  imageUrl: string | null;
  aspect: number | null;      // width / height, из image_w и image_h
  missingCount: number;
  isFavorite?: boolean;
  categoryIcon?: React.ReactNode;
}

interface Props {
  dish: DishTileData;
  selected?: boolean;
  selectable?: boolean;
  onClick: () => void;
}

/**
 * Плитка кладки (D-023, D-026).
 *
 * Медаль на ленте выезжает из-под верхнего края: лента идёт первой,
 * медаль догоняет с перелётом. Всё, что выше края, обрезается — поэтому
 * в невыбранном состоянии медали нет, а не «прилетает» через соседнюю плитку.
 *
 * Левый край медали, ленты и названия стоят на одной вертикали:
 * 0.5px обводки плюс 10px внутреннего отступа (backlog п. 18).
 */
export function DishTile({ dish, selected, selectable, onClick }: Props) {
  /*
   * Блюда из справочника ссылаются на картинку по ключу, но библиотека картинок
   * пока пустая. Если снимок не загрузился, показываем иконку категории,
   * а не пустую плитку.
   */
  const [broken, setBroken] = useState(false);
  const imageUrl = broken ? null : dish.imageUrl;
  const height = dish.aspect ? undefined : 104;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      className={cn(
        'relative mb-1.5 block w-full cursor-pointer break-inside-avoid rounded-tile',
        'border-[0.5px] transition-colors duration-200',
        selected ? 'border-accent/70' : 'border-transparent',
      )}
    >
      {/* Обойма для ленты и медали: обрезает всё, что выше верхнего края */}
      <span className="pointer-events-none absolute -left-[0.5px] -right-[0.5px] -top-[0.5px] z-[3] h-16 overflow-hidden rounded-t-tile">
        {/*
         * Лента раскрывается сверху вниз через clip-path, а не scaleY:
         * при масштабировании сжималась и её обводка, и лента «мигала» (backlog п. 17).
         */}
        <span
          className={cn(
            'absolute left-[10.5px] top-0 box-border h-[26px] w-[30px]',
            'rounded-b-[12px] border-x-[0.5px] border-b-[0.5px] border-accent/70 bg-black',
            'transition-[clip-path] duration-200 ease-out',
            selected
              ? '[clip-path:inset(0_0_0_0)] delay-0'
              : '[clip-path:inset(0_0_100%_0)] delay-100',
          )}
        />
        <span
          className={cn(
            'absolute left-[10.5px] top-[11px] leading-none transition-transform',
            selected
              ? 'translate-y-0 duration-300 ease-spring delay-[60ms]'
              : '-translate-y-12 duration-200 ease-in',
          )}
        >
          <Medal />
        </span>
      </span>

      <div
        className="relative overflow-hidden rounded-[4px] bg-surface-2"
        style={{ aspectRatio: dish.aspect ?? undefined, height }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-line">
            {dish.categoryIcon ?? <Camera className="h-6 w-6 text-[#3E3E3E]" />}
          </div>
        )}

        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.45) 24%, rgba(0,0,0,0) 56%)',
          }}
        />

        {dish.missingCount > 0 && (
          <span className="absolute right-2 top-2 z-[2] text-micro text-[#D9D9D9]">
            −{dish.missingCount}
          </span>
        )}

        <span
          className={cn(
            'font-display absolute bottom-2 left-2.5 right-2.5 text-headline leading-tight transition-colors duration-200',
            selected ? 'text-accent' : imageUrl ? 'text-white' : 'text-[#B8B8B8]',
          )}
        >
          {dish.name}
        </span>
      </div>
    </div>
  );
}
