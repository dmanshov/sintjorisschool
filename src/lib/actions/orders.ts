'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getChild, isParentOf } from '@/lib/data/children';
import { requireAdmin, requireStaff, requireUser } from '@/lib/auth/session';
import { getContent } from '@/lib/data/content';
import {
  BADMUTS_COLORS,
  GYM_SIZES,
  ORDER_STATUSES,
  ORDER_TYPES,
  orders,
  type OrderStatus,
  type OrderType,
} from '@db/schema';

export type ActionState = { error?: string; success?: string } | null;

function isOrderType(value: unknown): value is OrderType {
  return typeof value === 'string' && (ORDER_TYPES as readonly string[]).includes(value);
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Places an order for one child.
 *
 * The denormalised name/classroom columns are filled here, on the server, from
 * the child record — not from the form. The old app sent them from the client,
 * so anyone could post an order attributed to another family.
 */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const orderType = formData.get('orderType');
  const childId = String(formData.get('childId') ?? '');
  const quantityRaw = formData.get('quantity');
  const color = String(formData.get('color') ?? '').trim();
  const size = String(formData.get('size') ?? '').trim();
  const dates = formData.getAll('consumptionDates').map(String).filter(Boolean);

  if (!isOrderType(orderType)) return { error: 'Onbekend type bestelling.' };
  if (!childId) return { error: 'Bevestig de naam van je kind.' };
  if (!(await isParentOf(user.id, childId))) {
    return { error: 'Je kan enkel bestellen voor je eigen gezinsleden.' };
  }

  const child = await getChild(childId);
  if (!child) return { error: 'Dit gezinslid werd niet gevonden.' };

  const quantity = Math.max(1, Math.min(50, Number(quantityRaw ?? 1) || 1));

  if (orderType === 'Badmuts') {
    if (!(BADMUTS_COLORS as readonly string[]).includes(color)) {
      return { error: 'Selecteer een kleur.' };
    }
  }
  if (orderType === 'Gym T-shirt') {
    if (!(GYM_SIZES as readonly string[]).includes(size)) {
      return { error: 'Selecteer een maat.' };
    }
  }

  let consumptionMonth: string | null = null;
  if (orderType === 'Maaltijd') {
    const content = await getContent();
    const open = content.maaltijdDatums;
    if (open.length === 0) {
      return { error: 'Er kunnen momenteel geen maaltijden besteld worden.' };
    }
    const invalid = dates.filter((d) => !open.includes(d));
    if (dates.length === 0) return { error: 'Selecteer minstens één datum.' };
    if (invalid.length > 0) {
      // The list of open dates is authoritative server-side; a stale or edited
      // form cannot book a date the school has closed.
      return { error: 'Eén of meer van de geselecteerde datums staan niet (meer) open.' };
    }
    consumptionMonth = content.maaltijdMaand ?? null;
  }

  await db.insert(orders).values({
    id: randomBytes(12).toString('hex'),
    orderType,
    status: 'Besteld',
    quantity: orderType === 'Maaltijd' ? dates.length : quantity,
    createdById: user.id,
    createdForId: child.id,
    createdByName: user.displayName,
    createdBySurname: user.surname,
    createdByEmail: user.email,
    createdForName: child.name,
    createdForSurname: child.surname,
    createdForClassroom: child.classroom,
    color: orderType === 'Badmuts' ? color : null,
    size: orderType === 'Gym T-shirt' ? size : null,
    consumptionMonth,
    consumptionDates: orderType === 'Maaltijd' ? dates : [],
  });

  revalidatePath('/profiel');
  revalidatePath('/admin');
  return { success: 'Je bestelling werd met succes geplaatst.' };
}

/**
 * A parent cancelling their own order. Only possible while it is still 'Besteld':
 * once the teacher has handed the item out, cancelling it would make the
 * invoice wrong.
 */
export async function cancelOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const orderId = String(formData.get('orderId') ?? '');

  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return { error: 'Deze bestelling werd niet gevonden.' };

  if (order.createdById !== user.id && !user.admin) {
    return { error: 'Je kan enkel je eigen bestellingen annuleren.' };
  }
  if (order.status !== 'Besteld' && !user.admin) {
    return { error: 'Deze bestelling is al uitgedeeld en kan niet meer geannuleerd worden.' };
  }

  await db.delete(orders).where(eq(orders.id, orderId));

  revalidatePath('/profiel');
  revalidatePath('/admin');
  return { success: 'Bestelling werd geannuleerd.' };
}

/** Update the dates on an existing meal order, while the month is still open. */
export async function updateMealOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const orderId = String(formData.get('orderId') ?? '');
  const dates = formData.getAll('consumptionDates').map(String).filter(Boolean);

  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return { error: 'Deze bestelling werd niet gevonden.' };
  if (order.createdById !== user.id && !user.admin) {
    return { error: 'Je kan enkel je eigen bestellingen aanpassen.' };
  }
  if (order.status !== 'Besteld' && !user.admin) {
    return { error: 'Deze bestelling is afgesloten en kan niet meer aangepast worden.' };
  }

  const content = await getContent();
  const invalid = dates.filter((d) => !content.maaltijdDatums.includes(d));
  if (invalid.length > 0) {
    return { error: 'Eén of meer van de geselecteerde datums staan niet (meer) open.' };
  }
  if (dates.length === 0) {
    return { error: 'Selecteer minstens één datum, of annuleer de bestelling.' };
  }

  await db
    .update(orders)
    .set({ consumptionDates: dates, quantity: dates.length, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath('/profiel');
  revalidatePath('/admin');
  return { success: 'De aanpassingen werden opgeslagen.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff operations
// ─────────────────────────────────────────────────────────────────────────────

/** Mark one order as handed out / invoiced. Teachers may only touch their class. */
export async function setOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const orderId = String(formData.get('orderId') ?? '');
  const status = formData.get('status');
  if (!isOrderStatus(status)) return { error: 'Onbekende status.' };

  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return { error: 'Deze bestelling werd niet gevonden.' };

  if (!user.admin) {
    const allowed = user.teacherClassroom ?? [];
    if (!order.createdForClassroom || !allowed.includes(order.createdForClassroom)) {
      return { error: 'Je kan enkel bestellingen van je eigen klas aanpassen.' };
    }
  }

  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  revalidatePath('/admin');
  revalidatePath('/profiel');
  return { success: 'De status werd aangepast.' };
}

/**
 * The "Bestellingen factureren" button: move every order of one type from
 * 'Besteld' to 'Uitgedeeld' in a single statement.
 *
 * The old app did this with a client-side loop that read and wrote each document
 * one at a time (`batchUpdateOrderDocs`). With a few hundred orders that was
 * hundreds of round trips from a browser, and any failure halfway through left
 * the set inconsistent. This is one UPDATE.
 */
export async function bulkSetOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const orderType = formData.get('orderType');
  const from = formData.get('from');
  const to = formData.get('to');
  const consumptionMonth = String(formData.get('consumptionMonth') ?? '').trim();

  if (!isOrderType(orderType)) return { error: 'Onbekend type bestelling.' };
  if (!isOrderStatus(from) || !isOrderStatus(to)) return { error: 'Onbekende status.' };

  const where = [eq(orders.orderType, orderType), eq(orders.status, from)];
  if (consumptionMonth) where.push(eq(orders.consumptionMonth, consumptionMonth));

  const updated = await db
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(and(...where))
    .returning({ id: orders.id });

  revalidatePath('/admin');
  revalidatePath('/profiel');
  return {
    success: `${updated.length} bestelling(en) aangepast van "${from}" naar "${to}".`,
  };
}

/** Delete a set of orders outright. Admin only, and it says how many went. */
export async function bulkDeleteOrdersAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const ids = formData.getAll('orderId').map(String).filter(Boolean);
  if (ids.length === 0) return { error: 'Geen bestellingen geselecteerd.' };

  const deleted = await db.delete(orders).where(inArray(orders.id, ids)).returning({ id: orders.id });

  revalidatePath('/admin');
  return { success: `${deleted.length} bestelling(en) verwijderd.` };
}

/**
 * Keeps the denormalised classroom on open orders in step after a child changes
 * class, so the distribution list goes to the right teacher. Historic
 * ('Uitgedeeld', 'Gefactureerd') orders are deliberately left alone.
 */
export async function resyncOpenOrderClassroomsAction(): Promise<ActionState> {
  await requireAdmin();
  const updated = await db.execute(sql`
    update orders o
       set created_for_classroom = c.classroom,
           created_for_name      = c.name,
           created_for_surname   = c.surname,
           updated_at            = now()
      from children c
     where o.created_for_id = c.id
       and o.status = 'Besteld'
       and (o.created_for_classroom is distinct from c.classroom
            or o.created_for_name is distinct from c.name
            or o.created_for_surname is distinct from c.surname)
  `);
  revalidatePath('/admin');
  return { success: `Open bestellingen bijgewerkt (${updated.rowCount ?? 0} rij(en)).` };
}
