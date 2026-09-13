import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, type Order, type OrderStatus, type OrderType } from '@db/schema';

export type OrderFilter = {
  type?: OrderType;
  status?: OrderStatus | OrderStatus[];
  createdById?: string;
  createdForId?: string;
  classrooms?: string[];
  consumptionMonth?: string;
  limit?: number;
  offset?: number;
};

function conditions(filter: OrderFilter): SQL | undefined {
  const parts: SQL[] = [];
  if (filter.type) parts.push(sql`${orders.orderType} = ${filter.type}`);
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    parts.push(inArray(orders.status, statuses));
  }
  if (filter.createdById) parts.push(sql`${orders.createdById} = ${filter.createdById}`);
  if (filter.createdForId) parts.push(sql`${orders.createdForId} = ${filter.createdForId}`);
  if (filter.classrooms && filter.classrooms.length > 0) {
    parts.push(inArray(orders.createdForClassroom, filter.classrooms));
  }
  if (filter.consumptionMonth) parts.push(sql`${orders.consumptionMonth} = ${filter.consumptionMonth}`);
  return parts.length > 0 ? and(...parts) : undefined;
}

export async function listOrders(filter: OrderFilter = {}): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(conditions(filter))
    .orderBy(desc(orders.createdAt))
    .limit(filter.limit ?? 200)
    .offset(filter.offset ?? 0);
}

export async function countOrders(filter: OrderFilter = {}): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(conditions(filter));
  return rows[0]?.count ?? 0;
}

/** Totals per classroom, which is what the school actually invoices from. */
export async function orderTotalsByClassroom(type: OrderType, status: OrderStatus) {
  return db
    .select({
      classroom: orders.createdForClassroom,
      orderCount: sql<number>`count(*)::int`,
      quantity: sql<number>`coalesce(sum(${orders.quantity}), 0)::float`,
    })
    .from(orders)
    .where(and(eq(orders.orderType, type), eq(orders.status, status)))
    .groupBy(orders.createdForClassroom)
    .orderBy(orders.createdForClassroom);
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV export. Same columns and the same semicolon separator as the old
// downloadOrdersAsCSV custom action, so whatever the school pastes this into
// keeps working — but with proper escaping, which the Dart version did not have:
// a child's name containing a semicolon or a newline used to shift every
// following column by one.
// ─────────────────────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'Type',
  'Besteldatum',
  'LaatsteAanpassing',
  'OuderNaam',
  'OuderVoornaam',
  'KindNaam',
  'KindVoornaam',
  'Klas',
  'Status',
  'Aantal',
  'Kleur',
  'Maat',
  'MaaltijdMaand',
  'MaaltijdData',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? formatDateTime(value) : String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatDateTime(date: Date): string {
  // Brussels local time, because the school reads these by hand.
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ordersToCsv(rows: Order[]): string {
  const lines = [
    'Sint-Jorisschool',
    '',
    CSV_HEADERS.join(';'),
    ...rows.map((order) =>
      [
        order.orderType,
        order.createdAt,
        order.updatedAt,
        order.createdBySurname,
        order.createdByName,
        order.createdForSurname,
        order.createdForName,
        order.createdForClassroom,
        order.status,
        order.quantity,
        order.color,
        order.size,
        order.consumptionMonth,
        order.consumptionDates.join(', '),
      ]
        .map(csvCell)
        .join(';'),
    ),
  ];
  // BOM so Excel on Windows opens it as UTF-8 and does not mangle é and ë.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function csvFilename(type: OrderType | 'Alle', suffix?: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const slug = type.replace(/\s+/g, '_');
  return `Bestellingen_${slug}${suffix ? `_${suffix}` : ''}_${stamp}.csv`;
}
