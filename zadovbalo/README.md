# Задовбало

Емоційний інтерактивний вебсервіс: 2–5 хвилин, щоб випустити пару. **Напруга → випуск → полегшення.**
Не психотерапія, не діагнози, не AI-психолог.

Окремий Next.js-застосунок у підтеці репозиторію (кондитерський сайт у корені не зачіпає).

## Запуск

```bash
cd zadovbalo
npm install
cp .env.example .env.local   # за потреби
npm run dev                  # http://localhost:3000
npm run build && npm start   # продакшн
npm run typecheck && npm run lint && npm test
npm run media:hero -- <вихідне-відео>   # перегенерувати hero-відео (потрібен ffmpeg)
```

Деплой на Vercel: окремий проєкт із **Root Directory = `zadovbalo`**.

## Змінні середовища

| Змінна | Де | Призначення |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build | canonical, OG, sitemap |
| `AI_PROVIDER` | server | `mock` (єдиний реалізований) |
| `AI_API_KEY` | server | ключ справжнього AI, коли зʼявиться провайдер. Ніколи не `NEXT_PUBLIC_` |
| `AI_TIMEOUT_MS` | server | таймаут класифікації (1000–60000, за замовчуванням 12000) |
| `NEXT_PUBLIC_SPEECH_PROVIDER` | build | `browser` (Web Speech API) або `server` (запис → `/api/transcribe`) |
| `SPEECH_PROVIDER`, `SPEECH_API_KEY` | server | серверне STT; поки не задано — `/api/transcribe` відповідає 501 |

## Архітектура

```
src/
  app/
    page.tsx               головна: JSON-LD + <Experience/>
    about/ privacy/        статичні сторінки
    api/analyze/           safety → класифікатор (таймаут) → zod-валідація → нормалізація
    api/transcribe/        серверне STT за інтерфейсом (зараз 501 not_configured)
    api/events/            агреговані події без тексту → структурований лог
    error.tsx global-error.tsx not-found.tsx sitemap.ts robots.ts icon.svg fonts.ts
  components/
    hero/        StormHero (відео/постер, кросфейд гроза→спокій), HeroCopy, SceneVideo, ScenePoster
    flow/        Experience (стан-машина етапів), state.ts (reducer), StagePanel, ErrorPanel, Outcome
    input/       RantInput, VoiceInput, Waveform, useVoiceRecorder
    ai/          Analyzing, TopicResults, TopicChip
    mechanics/   MechanicRenderer (реєстр + lazy), SwipeMechanic, BreatheMechanic
    safety/      SafetyFlow
    ui/          Button, SiteChrome, motion-пресети
  lib/
    topics/      50 категорій, емоції, тони
    mechanics/   20 типів механік, мета (руйнівна чи ні), що вже реалізовано
    scenarios/   registry.ts — конфіг кожного тригера; resolve.ts — вибір механіки з урахуванням safety
    ai/          schema (zod), RantClassifier, providers/{index,mock}, service, client, contract
    safety/      детермінований класифікатор (до AI), контакти допомоги
    speech/      SpeechProvider: browser / server
    analytics/   дозволені події + схема; track()
    session/     анонімна сесія в sessionStorage (лише ідентифікатори)
    server/      структуровані логи, rate limit, request id
```

### Потік

`intro («Задовбало?») → exhale («Видихни.») → write | dictate → analyzing → results («З чого почнемо?») → mechanic → done («Ще бісить?») → finished`
Окремо: `safety` (кризовий режим, без механік) і `error` («Щось зависло. Не ти — сайт.»).

### Як додати тригер

1. Додати id у `lib/topics/categories.ts`.
2. Додати запис у `lib/scenarios/registry.ts` (механіка, асет, елементи, тексти).
3. Додати ключові слова в `lib/ai/providers/mock.ts` (для справжнього AI — у промпт/схему).
Тест `scenarios/registry.test.ts` перевірить, що сценарій грається й безпечний.

### Як додати механіку

1. Компонент у `components/mechanics/` з пропсами `MechanicProps`, `export default`.
2. Додати тип у `IMPLEMENTED_MECHANICS` (`lib/mechanics/registry.ts`) і в `COMPONENTS` у `MechanicRenderer`.
Усі сценарії з цією механікою автоматично перестануть використовувати fallback.

### Як підключити справжній AI

Реалізувати `RantClassifier` (`lib/ai/types.ts`) і зареєструвати в `lib/ai/providers/index.ts`.
Відповідь провайдера все одно проходить safety-шар (до виклику), таймаут, zod-схему і нормалізацію.
Після підключення — оновити текст на `/privacy` (кому передається текст).

## Безпека, приватність, логування

- Safety-класифікатор працює **до** AI. `crisis` → спокійний екран допомоги, жодних механік; `caution` (агресивні
  фігури мови без плану) → руйнівні механіки замінюються неруйнівними.
- Текст не зберігається й не логується; у логах — лише request id, маршрут, статус, тип помилки, тривалість.
- Голос: браузерне розпізнавання (Chrome — Google, Safari — Apple); аудіо ми не отримуємо й не зберігаємо.
  Серверний режим тримає аудіо лише в памʼяті запиту.
- Аналітика приймає лише ідентифікатори з реєстрів (схема `.strict()`), поважає Do Not Track.

## Hero-медіа

Вихідник — портрет 512×910, ~10 с. `scripts/encode-hero.sh` ріже його на дві петлі-бумеранги
(гроза 0–3.1 с; спокійні хмари 3.4–5.4 с, сповільнено), прибирає розмиті смуги, робить портретну й
горизонтальну версії (WebM VP9 + MP4 H.264), постери WebP і OG-зображення. Відео вмикається лише після `load`,
не вантажиться при reduced-motion чи «Економії трафіку».
