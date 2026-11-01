# CashFlowPlaner

Календарь событий (поездки, дни рождения, врачи, покупки) со стоимостью, общими тратами
и прогнозом денег по месяцам: где я в плюсе, где в минусе.

## Стек
- Next.js (App Router) + TypeScript + Tailwind CSS
- Neon Postgres + Drizzle ORM
- Vercel (хостинг), PWA

## Запуск локально
```bash
cp .env.example .env.local   # вставить DATABASE_URL из Neon
npm install
npm run dev
```

## База данных
- Схема: `src/db/schema.ts`
- Начальный SQL (уже применён к Neon): `db/init.sql`
- Изменения схемы: правим `schema.ts`, затем `npx drizzle-kit push`

## Структура
```
src/app/            страницы: / (прогноз), /calendar, /add, /ideas, /more
src/app/api/health  проверка подключения к БД
src/components/     нижнее меню, заголовки, регистрация service worker
src/lib/forecast.ts расчёт прогноза баланса по месяцам
public/sw.js        service worker (PWA)
```
