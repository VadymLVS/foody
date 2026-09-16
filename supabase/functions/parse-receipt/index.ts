/**
 * Разбор фотографии чека.
 *
 * Живёт на сервере по одной причине: ключ модели нельзя класть в приложение.
 * Всё, что попадает в сборку, видно любому, кто откроет исходники страницы,
 * и чужой ключ израсходуют за счёт владельца. anon key Supabase публичен
 * по замыслу и защищён RLS, а этот — нет.
 *
 * Снимок нигде не сохраняется: принимается, отправляется модели и забывается.
 *
 * Развёртывание — Supabase Dashboard → Edge Functions → Deploy a new function.
 * Секрет ANTHROPIC_API_KEY задаётся там же, в Settings → Edge Functions → Secrets.
 */

const MODEL = 'claude-sonnet-5';
const MAX_BYTES = 6 * 1024 * 1024;

const SYSTEM_PROMPT = `Ты разбираешь фотографии магазинных чеков.

Верни ТОЛЬКО JSON без пояснений и без markdown-обёртки:
{"items":[{"raw":"строка как в чеке","name":"понятное название","qty":число,"unit":"pcs|kg|g|l|ml|pack","category":"vegetables|fruits|dairy|meat_fish|bakery|pantry|frozen|drinks|sweets|household|other","food":true|false}]}

Правила:
- Названия в чеках сокращённые и на языке магазина. Расшифруй и переведи на русский: "L.DESN.S/L.ASTUR.1L" → "Молоко обезжиренное", "PAN REBANA.CENTENO" → "Хлеб ржаной нарезной".
- qty бери из колонки количества. Если её нет — 1.
- unit выбирай по смыслу товара: молоко в литрах, овощи в килограммах, штучное в pcs, упаковки в pack.
- food=false для непродовольственного: пакеты, мыло, бытовая химия.
- Строки итогов, скидок, НДС и номера карт пропускай полностью.
- Если строка нечитаема — пропусти её, не выдумывай.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Функция доступна только вошедшим: иначе чужой ключ тратят все подряд
  if (!req.headers.get('Authorization')) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  let payload: { image?: string; mediaType?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const { image, mediaType = 'image/jpeg' } = payload;
  if (!image) return json({ error: 'no_image' }, 400);
  if (image.length * 0.75 > MAX_BYTES) return json({ error: 'image_too_large' }, 413);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Разбери этот чек.' },
          ],
        }],
      }),
    });

    if (!response.ok) {
      return json({ error: 'model_error', status: response.status }, 502);
    }

    const data = await response.json();
    const text: string = (data.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('');

    // Модель иногда оборачивает ответ в тройные кавычки, несмотря на запрет
    const cleaned = text.replace(/```json|```/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      return json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
    } catch {
      return json({ error: 'unparseable_response' }, 502);
    }
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
});
