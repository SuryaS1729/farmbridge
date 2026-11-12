import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const priceStatus = pgEnum("price_status", [
  "draft",
  "published",
  "withdrawn",
]);
export const offerStatus = pgEnum("offer_status", [
  "pending",
  "invalid_needs_revision",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
]);
export const dealStatus = pgEnum("deal_status", ["open", "completed", "cancelled"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified"),
  role: text("role", { enum: ["farmer", "admin"] })
    .default("farmer")
    .notNull(),
});

export const farmerProfile = pgTable("farmer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  authUserId: text("auth_user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const commodities = pgTable(
  "commodities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    unit: text("unit").default("kg").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [check("commodities_unit_check", sql`${table.unit} = 'kg'`)],
);

export const dailyPrices = pgTable(
  "daily_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commodityId: uuid("commodity_id")
      .notNull()
      .references(() => commodities.id),
    businessDate: date("business_date").notNull(),
    basePricePerKg: numeric("base_price_per_kg", {
      precision: 12,
      scale: 4,
    }).notNull(),
    currency: char("currency", { length: 3 }).default("INR").notNull(),
    status: priceStatus("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("daily_prices_commodity_business_date_unique").on(
      table.commodityId,
      table.businessDate,
    ),
    check(
      "daily_prices_base_price_nonnegative_check",
      sql`${table.basePricePerKg} >= 0`,
    ),
    check(
      "daily_prices_published_at_check",
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
    check("daily_prices_inr_currency_check", sql`${table.currency} = 'INR'`),
    index("daily_prices_date_status_idx").on(
      table.businessDate.desc(),
      table.status,
    ),
  ],
);

export const priceRevisions = pgTable(
  "price_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dailyPriceId: uuid("daily_price_id")
      .notNull()
      .references(() => dailyPrices.id),
    oldPricePerKg: numeric("old_price_per_kg", { precision: 12, scale: 4 }),
    newPricePerKg: numeric("new_price_per_kg", {
      precision: 12,
      scale: 4,
    }).notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "price_revisions_new_price_nonnegative_check",
      sql`${table.newPricePerKg} >= 0`,
    ),
    index("price_revisions_price_time_idx").on(
      table.dailyPriceId,
      table.createdAt.desc(),
    ),
  ],
);

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmerProfile.id),
    dailyPriceId: uuid("daily_price_id")
      .notNull()
      .references(() => dailyPrices.id),
    offeredPricePerKg: numeric("offered_price_per_kg", {
      precision: 12,
      scale: 2,
    }).notNull(),
    quantityKg: numeric("quantity_kg", { precision: 12, scale: 3 }).notNull(),
    moisturePercent: numeric("moisture_percent").notNull(),
    beanCountPer100g: numeric("bean_count_per_100g").notNull(),
    readyOn: date("ready_on").notNull(),
    status: offerStatus("status").default("pending").notNull(),
    rejectionReason: text("rejection_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("offers_price_nonnegative_check", sql`${table.offeredPricePerKg} >= 0`),
    check("offers_quantity_positive_check", sql`${table.quantityKg} > 0`),
    check(
      "offers_moisture_percentage_check",
      sql`${table.moisturePercent} >= 0 AND ${table.moisturePercent} <= 100`,
    ),
    check("offers_bean_count_positive_check", sql`${table.beanCountPer100g} > 0`),
    check(
      "offers_expiry_after_submission_check",
      sql`${table.expiresAt} > ${table.submittedAt}`,
    ),
    uniqueIndex("offers_one_active_per_farmer_idx")
      .on(table.farmerId)
      .where(
        sql`${table.status} IN ('pending', 'invalid_needs_revision')`,
      ),
    index("offers_admin_queue_idx").on(
      table.status,
      table.submittedAt.desc(),
    ),
    index("offers_farmer_history_idx").on(
      table.farmerId,
      table.createdAt.desc(),
    ),
    index("offers_daily_price_idx").on(table.dailyPriceId),
  ],
);

export const offerEvents = pgTable(
  "offer_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id),
    eventType: text("event_type").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    reason: text("reason"),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "offer_events_event_type_nonempty_check",
      sql`length(trim(${table.eventType})) > 0`,
    ),
    check(
      "offer_events_actor_type_check",
      sql`${table.actorType} IN ('farmer', 'admin', 'system')`,
    ),
    index("offer_events_history_idx").on(table.offerId, table.createdAt.desc()),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offerId: uuid("offer_id")
      .notNull()
      .unique()
      .references(() => offers.id),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmerProfile.id),
    acceptedBy: text("accepted_by")
      .notNull()
      .references(() => user.id),
    offeredPricePerKg: numeric("offered_price_per_kg", {
      precision: 12,
      scale: 2,
    }).notNull(),
    quantityKg: numeric("quantity_kg", { precision: 12, scale: 3 }).notNull(),
    moisturePercent: numeric("moisture_percent").notNull(),
    beanCountPer100g: numeric("bean_count_per_100g").notNull(),
    readyOn: date("ready_on").notNull(),
    pickupLocation: text("pickup_location"),
    pickupScheduledOn: date("pickup_scheduled_on"),
    pickupScheduledAt: timestamp("pickup_scheduled_at", { withTimezone: true }),
    pickupScheduledBy: text("pickup_scheduled_by").references(() => user.id),
    collectedOn: date("collected_on"),
    collectedWeightKg: numeric("collected_weight_kg", { precision: 12, scale: 3 }),
    collectionRecordedAt: timestamp("collection_recorded_at", { withTimezone: true }),
    collectionRecordedBy: text("collection_recorded_by").references(() => user.id),
    status: dealStatus("status").default("open").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("deals_price_positive_check", sql`${table.offeredPricePerKg} > 0`),
    check("deals_quantity_positive_check", sql`${table.quantityKg} > 0`),
    check(
      "deals_collected_weight_positive_check",
      sql`${table.collectedWeightKg} is null or ${table.collectedWeightKg} > 0`,
    ),
    check(
      "deals_collection_fields_together_check",
      sql`(${table.collectedOn} is null) = (${table.collectedWeightKg} is null)`,
    ),
    index("deals_farmer_history_idx").on(table.farmerId, table.acceptedAt.desc()),
    index("deals_status_idx").on(table.status, table.acceptedAt.desc()),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  farmerProfile: one(farmerProfile),
}));

export const farmerProfileRelations = relations(farmerProfile, ({ one }) => ({
  user: one(user, {
    fields: [farmerProfile.authUserId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
