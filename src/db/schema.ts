import {
  pgTable,
  pgEnum,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  boolean,
  integer,
  char,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

/*
 * user_id — идентификатор пользователя из системы авторизации (Neon Auth),
 * поэтому хранится как text без внешнего ключа.
 * Деньги — numeric(14,2), валюта — ISO-код из 3 букв.
 */

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

// ---------- enums ----------
export const memberRole = pgEnum("member_role", ["owner", "editor", "viewer"]);
export const eventType = pgEnum("event_type", ["trip", "birthday", "health", "purchase", "other"]);
export const eventStatus = pgEnum("event_status", ["idea", "planned", "confirmed", "done", "cancelled"]);
export const eventPriority = pgEnum("event_priority", ["must", "want", "movable"]);
export const eventVisibility = pgEnum("event_visibility", ["calendar", "private"]);
export const recurrence = pgEnum("recurrence", ["none", "yearly", "monthly"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "partial", "paid"]);
export const shareType = pgEnum("share_type", ["equal", "percent", "amount"]);

// ---------- профиль ----------
export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  baseCurrency: char("base_currency", { length: 3 }).default("CZK").notNull(),
  timezone: text("timezone").default("Europe/Prague").notNull(),
  cushionAmount: money("cushion_amount").default("0").notNull(),
  username: text("username"),
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  searchable: boolean("searchable").default(true).notNull(),
  locale: text("locale"), // язык интерфейса — для текстов уведомлений
  createdAt: created(),
});

// ---------- календари и доступ ----------
export const calendars = pgTable("calendars", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  createdAt: created(),
});

export const calendarMembers = pgTable(
  "calendar_members",
  {
    calendarId: uuid("calendar_id").notNull().references(() => calendars.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: memberRole("role").default("viewer").notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.calendarId, t.userId] })],
);

export const calendarInvites = pgTable("calendar_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  calendarId: uuid("calendar_id").notNull().references(() => calendars.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: memberRole("role").default("viewer").notNull(),
  createdBy: text("created_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  acceptedBy: text("accepted_by"),
  inviteeUserId: text("invitee_user_id"), // приглашение конкретному пользователю (по email)
  createdAt: created(),
});

// ---------- события ----------
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id").notNull().references(() => calendars.id, { onDelete: "cascade" }),
    type: eventType("type").default("other").notNull(),
    title: text("title").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    startTime: text("start_time"), // "HH:MM", пусто — весь день
    endTime: text("end_time"),
    status: eventStatus("status").default("planned").notNull(),
    priority: eventPriority("priority").default("want").notNull(),
    visibility: eventVisibility("visibility").default("calendar").notNull(),
    recurrence: recurrence("recurrence").default("none").notNull(),
    currency: char("currency", { length: 3 }).default("CZK").notNull(),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: created(),
  },
  (t) => [index("events_calendar_start_idx").on(t.calendarId, t.startDate)],
);

export const eventParticipants = pgTable(
  "event_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id"), // null = гость без аккаунта
    displayName: text("display_name").notNull(),
    role: memberRole("role").default("editor").notNull(),
    inviteToken: text("invite_token").unique(),
    createdAt: created(),
  },
  (t) => [index("participants_event_idx").on(t.eventId), index("participants_user_idx").on(t.userId)],
);

export const expenseItems = pgTable(
  "expense_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category"),
    amount: money("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    isEstimate: boolean("is_estimate").default(true).notNull(),
    dueDate: date("due_date"),
    status: paymentStatus("status").default("unpaid").notNull(),
    paidByParticipantId: uuid("paid_by_participant_id").references(() => eventParticipants.id, {
      onDelete: "set null",
    }),
    createdAt: created(),
  },
  (t) => [index("expense_event_idx").on(t.eventId), index("expense_due_idx").on(t.dueDate)],
);

export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseItemId: uuid("expense_item_id").notNull().references(() => expenseItems.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id").notNull().references(() => eventParticipants.id, { onDelete: "cascade" }),
    shareType: shareType("share_type").default("equal").notNull(),
    value: numeric("value", { precision: 14, scale: 4 }),
  },
  (t) => [primaryKey({ columns: [t.expenseItemId, t.participantId] })],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseItemId: uuid("expense_item_id").notNull().references(() => expenseItems.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").references(() => eventParticipants.id, { onDelete: "set null" }),
  amount: money("amount").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  paidAt: date("paid_at").notNull(),
  rateToBase: numeric("rate_to_base", { precision: 18, scale: 8 }),
  createdAt: created(),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  fromParticipantId: uuid("from_participant_id").notNull().references(() => eventParticipants.id, { onDelete: "cascade" }),
  toParticipantId: uuid("to_participant_id").notNull().references(() => eventParticipants.id, { onDelete: "cascade" }),
  amount: money("amount").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  settledAt: date("settled_at"),
  createdAt: created(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  done: boolean("done").default(false).notNull(),
  assigneeParticipantId: uuid("assignee_participant_id").references(() => eventParticipants.id, {
    onDelete: "set null",
  }),
  createdAt: created(),
});

// ---------- ПРИВАТНЫЕ финансы (доступ только владельцу) ----------
export const incomeSources = pgTable("income_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  currency: char("currency", { length: 3 }).default("CZK").notNull(),
  payDay: integer("pay_day"), // примерный день месяца
  isFixed: boolean("is_fixed").default(false).notNull(), // «одинаковая каждый месяц»
  defaultAmount: money("default_amount"),
  active: boolean("active").default(true).notNull(),
  createdAt: created(),
});

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id").notNull().references(() => incomeSources.id, { onDelete: "cascade" }),
    month: date("month").notNull(), // первое число месяца
    expectedAmount: money("expected_amount"),
    actualAmount: money("actual_amount"),
    receivedAt: date("received_at"),
    createdAt: created(),
  },
  (t) => [index("incomes_source_month_idx").on(t.sourceId, t.month), uniqueIndex("incomes_source_month_uq").on(t.sourceId, t.month)],
);

/** Разовый доход: премия, возврат налога, продажа вещи — одна сумма в одну дату. Только владельцу. */
export const oneTimeIncomes = pgTable(
  "one_time_incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    amount: money("amount").notNull(),
    currency: char("currency", { length: 3 }).default("CZK").notNull(),
    date: date("date").notNull(),
    createdAt: created(),
  },
  (t) => [index("one_time_incomes_owner_idx").on(t.ownerId, t.date)],
);

export const fixedExpenses = pgTable("fixed_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  amount: money("amount").notNull(),
  currency: char("currency", { length: 3 }).default("CZK").notNull(),
  dayOfMonth: integer("day_of_month"),
  activeFrom: date("active_from"),
  activeTo: date("active_to"),
  createdAt: created(),
});

export const balanceSnapshots = pgTable("balance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  amount: money("amount").notNull(),
  currency: char("currency", { length: 3 }).default("CZK").notNull(),
  asOfDate: date("as_of_date").notNull(),
  createdAt: created(),
});

// ---------- авторизация (Better Auth) ----------
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const authSession = pgTable("auth_session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
});

export const authAccount = pgTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

export const authVerification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
});

// ---------- справочник курсов ----------
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    date: date("date").notNull(),
    base: char("base", { length: 3 }).notNull(),
    quote: char("quote", { length: 3 }).notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.base, t.quote] })],
);

// ---------- push-уведомления ----------
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  locale: text("locale").default("en").notNull(),
  createdAt: created(),
});

/** Не больше одного напоминания пользователю в день. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    userId: text("user_id").notNull(),
    day: date("day").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

// ---------- профиль, друзья, чаты ----------
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const avatars = pgTable("avatars", {
  userId: text("user_id").primaryKey().references(() => authUser.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
  mime: text("mime").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: text("requester_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  addresseeId: text("addressee_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "accepted">().default("pending").notNull(),
  createdAt: created(),
});

/** Чат: либо события (eventId), либо личный (userA < userB). */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").unique().references(() => events.id, { onDelete: "cascade" }),
  userA: text("user_a").references(() => authUser.id, { onDelete: "cascade" }),
  userB: text("user_b").references(() => authUser.id, { onDelete: "cascade" }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: created(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: created(),
});

export const chatReads = pgTable(
  "chat_reads",
  {
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] })],
);

/** Центр уведомлений в приложении (то же, что приходит push-ом, кроме чатов). */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").default("/").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

// ---------- личные напоминания (лекарства и т.п.) ----------
/** Напоминание в заданные часы каждый день, push на телефон. times — "HH:MM" по часовому поясу владельца. */
export const personalReminders = pgTable(
  "personal_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    times: text("times").array().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: created(),
  },
  (t) => [index("personal_reminders_owner_idx").on(t.ownerId)],
);

/** Отправленные напоминания: slot = "YYYY-MM-DD HH:MM" (местное время). done_at — человек отметил «сделано». */
export const personalReminderSends = pgTable(
  "personal_reminder_sends",
  {
    reminderId: uuid("reminder_id").notNull().references(() => personalReminders.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.reminderId, t.slot] })],
);
