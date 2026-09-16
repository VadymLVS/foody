# PantrySync — Безопасность

> Документ обязателен к проверке перед каждым деплоем. Чеклист в конце — не формальность: половина пунктов закрывает ошибки, найденные в исходной спеке v0.1.

---

## 1. Что мы вообще защищаем

Приложение выглядит безобидно — «список продуктов». Но реально в нём лежит:

| Данные | Чувствительность | Риск при утечке |
|--------|-----------------|-----------------|
| Email пользователей | Средняя | Спам, credential stuffing |
| Состав семьи (участники кухни) | Средняя | Социальная инженерия |
| Фотографии блюд | **Высокая** | На фото кухня, окно, интерьер. EXIF содержит GPS-координаты квартиры |
| Паттерн покупок и наличия | Низкая, но | Пустой холодильник + отсутствие активности = никого нет дома |
| Инвайт-ссылка | **Высокая** | Даёт полный доступ к кухне, живёт в семейном чате навсегда |

Главный вывод: **инвайт-ссылка и фотографии — самые опасные объекты в системе**, а не пароли.

---

## 2. Модель угроз

| # | Угроза | Вероятность | Митигация |
|---|--------|-------------|-----------|
| T-1 | Авторизованный пользователь читает/пишет чужую кухню через прямые запросы к Supabase | **Высокая** — anon key публичен, API открыт | RLS на всех таблицах с `using` **и** `with check` (§3) |
| T-2 | Участник самоназначается владельцем через UPDATE `kitchen_members.role` | Высокая | Прямые INSERT/UPDATE на `kitchen_members` запрещены, только RPC |
| T-3 | Утечка `service_role` ключа в клиент или репозиторий | Средняя | §6, проверка в CI |
| T-4 | Перебор `invite_code` | Низкая (UUIDv4) | Плюс TTL 7 дней и возможность отзыва |
| T-5 | Утечка инвайт-ссылки из семейного чата / скриншота | **Высокая** | TTL, отзыв, переключатель «приглашения выключены» |
| T-6 | Геолокация квартиры через EXIF фото блюда | Средняя, последствия высокие | Стрип EXIF на клиенте (§5) |
| T-7 | XSS через название продукта, добавленное другим участником | Низкая | React экранирует; `dangerouslySetInnerHTML` запрещён |
| T-8 | SQL-инъекция | Низкая | PostgREST параметризует; в RPC — только типизированные параметры, никакой конкатенации |
| T-9 | Брутфорс входа | Средняя | Rate limit Supabase Auth + сильные пароли |
| T-10 | Кража сессии из `localStorage` | Средняя | В нативной сборке — secure storage; в вебе — короткий TTL access-токена |
| T-11 | Спам-создание кухонь/продуктов одним аккаунтом | Низкая | Лимиты в RPC (20 кухонь, 20 участников), лимит продуктов |
| T-12 | Раскрытие имени/названия кухни по чужому инвайт-коду | Низкая | `peek_invite()` отдаёт минимум и только по валидному коду |
| T-13 | Уязвимости в зависимостях | Средняя | Dependabot + `npm audit` в CI |
| T-14 | Небезопасная `SECURITY DEFINER`-функция (подмена `search_path`) | Средняя | Обязательный `set search_path = public` в каждой |

---

## 3. Row Level Security — правила, а не пожелания

Это единственный слой авторизации в приложении (после отказа от серверного слоя, **D-002**). Ошибка здесь = полная компрометация.

### Правила

1. **RLS включён на каждой таблице в `public`.** Без исключений. Таблица без RLS в Supabase доступна всем на чтение и запись.
2. **Никаких `for all using (...)`.** Политика на `for all` без `with check` пропускает любые INSERT/UPDATE. Именно эта ошибка была в спеке v0.1 — любой авторизованный пользователь мог вставить продукт в чужую кухню.
3. **У каждой пишущей политики есть `with check`**, и условие в нём не слабее, чем в `using`.
4. **Проверка членства — только через `is_kitchen_member()`.** Прямой подзапрос к `kitchen_members` внутри политики на `kitchen_members` даёт бесконечную рекурсию Postgres.
5. **Поля, которые клиент не должен задавать сам** (`role`, `owner_id`, `created_by`, `updated_by`), либо запрещены к прямой записи, либо проверяются в `with check` на равенство `auth.uid()`.
6. **Операции с изменением прав — только RPC** `SECURITY DEFINER`. Таблица `kitchen_members` не принимает прямые INSERT/UPDATE вообще.

### Требования к `SECURITY DEFINER`-функциям

Каждая такая функция обязана:

```sql
security definer
set search_path = public   -- иначе можно подменить схему и выполнить чужой код
```

и после создания:

```sql
revoke all on function public.<fn>(...) from public;
grant execute on function public.<fn>(...) to authenticated;
```

Без `revoke` функция доступна анонимным пользователям.

### Тест-кейсы RLS (обязательны перед релизом)

Создать два тестовых аккаунта A и B в разных кухнях и проверить, что **каждый** запрос падает или возвращает пусто:

```ts
// Под аккаунтом B, kitchenA — чужая кухня
await sb.from('products').select('*').eq('kitchen_id', kitchenA);        // → []
await sb.from('products').insert({ kitchen_id: kitchenA, name: 'x' });   // → error
await sb.from('products').update({ in_stock: true }).eq('id', productA); // → 0 rows
await sb.from('products').delete().eq('id', productA);                   // → 0 rows
await sb.from('kitchen_members').insert({ kitchen_id: kitchenA, user_id: B, role: 'owner' }); // → error
await sb.from('kitchen_members').update({ role: 'owner' }).eq('user_id', B);                 // → error
await sb.from('kitchens').update({ owner_id: B }).eq('id', kitchenA);    // → 0 rows
await sb.rpc('join_kitchen', { p_code: expiredCode });                   // → error
await sb.storage.from('dish-images').download(`${kitchenA}/x.webp`);     // → error
```

Эти проверки оформляются как автотесты (`vitest` + отдельный тестовый Supabase-проект) и гоняются в CI.

---

## 4. Аутентификация

**Настройки Supabase Auth:**

- [ ] Подтверждение email включено (иначе можно зарегистрироваться на чужой адрес).
- [ ] Минимальная длина пароля — 8 символов.
- [ ] **Leaked password protection включена** (Supabase проверяет по HaveIBeenPwned).
- [ ] Rate limit на попытки входа — оставить дефолтный или ужесточить.
- [ ] Redirect URLs — только явный whitelist: прод-домен, `localhost` для дева, `capacitor://localhost` для нативной сборки. Открытый redirect = кража токена.
- [ ] Access token TTL — 1 час, refresh token — с ротацией.
- [ ] JWT secret не покидает Supabase.

**Пароли:** проверка на клиенте — длина ≥ 8, не совпадает с email. Отдельно показываем индикатор силы, но не блокируем.

**Сессии:**
- Веб: сессия в `localStorage` (дефолт supabase-js). Принимаем риск XSS как низкий, т.к. React экранирует, а `dangerouslySetInnerHTML` запрещён линтером.
- Нативная сборка: `@capacitor/preferences` поверх Keychain/Keystore, кастомный `storage` адаптер в клиенте Supabase.

**Выход:** `signOut({ scope: 'local' })` по умолчанию; в настройках отдельная кнопка «Выйти на всех устройствах» → `scope: 'global'`.

---

## 5. Изображения

1. **EXIF снимается всегда, на клиенте, до загрузки.** Перерисовка через `canvas` гарантированно уничтожает метаданные:

```ts
export async function sanitizeImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(bmp.width  * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise(res =>
    canvas.toBlob(b => res(b!), 'image/webp', 0.8)
  );
}
```

2. **Проверка на клиенте:** MIME из первых байт (magic number), не из `file.type` — его можно подделать. Размер до 3 МБ.
3. **Бакет не публичный.** Доступ только по подписанным URL с TTL 1 час.
4. **Путь содержит `kitchen_id`** первым сегментом — на этом строятся политики `storage.objects`.
5. При удалении блюда файл удаляется — иначе накапливается мусор, доступный по старым подписанным ссылкам.

---

## 6. Ключи и секреты

| Ключ | Где живёт | Правило |
|------|-----------|---------|
| `SUPABASE_URL` | Клиент | Публичный, это нормально |
| `SUPABASE_ANON_KEY` | Клиент | Публичный **при условии, что RLS настроен**. Без RLS — это ключ от всей базы |
| `SUPABASE_SERVICE_ROLE_KEY` | **Нигде в этом проекте** | Обходит RLS полностью. Не в `.env.local`, не в Vercel, не в коде. Нужен только для локальных миграций |
| JWT secret | Только Supabase | |

**Проверки:**
- [ ] `.env*` в `.gitignore`, `.env.example` без значений.
- [ ] `git log -p | grep -i "service_role"` — пусто. Если ключ хоть раз был в истории — ротировать в Supabase, чистки истории недостаточно.
- [ ] В CI — `gitleaks` или `trufflehog` на каждый PR.
- [ ] В Vite переменные с префиксом `VITE_` попадают в бандл. Ничего секретного с этим префиксом.

---

## 7. Заголовки и транспорт

`vercel.json`:

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
    ]
  }]
}
```

`geolocation=()` — приложению геолокация не нужна ни при каких обстоятельствах, отключаем явно.
CSP без `unsafe-eval` — проверить, что сборка Vite в прод-режиме его не требует.

---

## 8. Валидация ввода

Двойная: Zod на клиенте (UX) + CHECK-констрейнты в БД (безопасность). Клиентскую валидацию обходят через прямой API-запрос, поэтому база должна отвергать мусор сама.

| Поле | Ограничение в БД |
|------|-----------------|
| `products.name` | 1–80 символов |
| `products.quantity` | `>= 0 and <= 100000`, `numeric(10,2)` |
| `products.unit` | enum через CHECK |
| `kitchens.name` | 1–60 символов |
| `dishes.name` | 1–80 символов |
| `profiles.full_name` | ≤ 100 символов |
| `kitchen_members.role` | `in ('owner','member')` |

Дополнительно: обрезка пробелов, запрет пустых строк после `trim`, ограничение количества продуктов на кухню (500) и блюд (200) — проверкой в RPC либо триггером.

---

## 9. Приватность и соответствие

- **Собираем минимум:** email, имя, аватар (опционально). Не собираем: телефон, геолокацию, контакты, рекламные идентификаторы. Это напрямую упрощает privacy-метки в App Store.
- **Аналитика:** если появится — только self-hosted или cookie-less (Plausible/Umami). Никакого Google Analytics и Facebook SDK: они тянут за собой отдельный набор обязательств по GDPR и App Tracking Transparency.
- **Политика конфиденциальности и удаление аккаунта** — обязательны (см. `05-store-readiness.md`).
- **Экспорт данных** (GDPR Art. 20) — кнопка «Скачать мои данные» в JSON. Не срочно, но дёшево сделать сразу.
- **Логи:** не логировать email, токены, содержимое ошибок Supabase в консоль в проде.

---

## 10. Зависимости и процесс

- [ ] Dependabot / Renovate включён.
- [ ] `npm audit --audit-level=high` в CI, падение сборки при high/critical.
- [ ] Прод-зависимости пересматриваются: каждая новая библиотека — вопрос «а зачем».
- [ ] Lockfile закоммичен.
- [ ] ESLint-правила: запрет `dangerouslySetInnerHTML`, `eval`, `any` в публичных API.

---

## 11. Чеклист перед деплоем

**База**
- [ ] RLS включён на всех таблицах в `public` (проверить в Supabase Dashboard → Auth → Policies, там же линтер)
- [ ] Ни одной политики `for all` без `with check`
- [ ] Все `SECURITY DEFINER`-функции имеют `set search_path = public`
- [ ] Все `SECURITY DEFINER`-функции: `revoke from public` + `grant to authenticated`
- [ ] Прямые INSERT/UPDATE на `kitchen_members` невозможны
- [ ] Тесты изоляции (§3) проходят
- [ ] Supabase Security Advisor — ноль ошибок

**Auth**
- [ ] Подтверждение email включено
- [ ] Leaked password protection включена
- [ ] Redirect URLs — только whitelist
- [ ] Удаление аккаунта работает и действительно удаляет

**Storage**
- [ ] Бакет `dish-images` не публичный
- [ ] Политики привязаны к `kitchen_id` в пути
- [ ] EXIF снимается (проверить `exiftool` на загруженном файле)

**Секреты**
- [ ] `service_role` не встречается нигде в репозитории и в истории git
- [ ] `.env` не закоммичен
- [ ] Сканер секретов в CI зелёный

**Транспорт**
- [ ] HTTPS-only, HSTS
- [ ] CSP настроен и не сломал приложение (проверить консоль)
- [ ] `geolocation=()` в Permissions-Policy

**Прочее**
- [ ] `npm audit` без high/critical
- [ ] Политика конфиденциальности опубликована и доступна из приложения
- [ ] В прод-сборке нет `console.log` с данными пользователя
