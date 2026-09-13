'use client';

import { useActionState } from 'react';
import {
  cancelOrderAction,
  placeOrderAction,
  updateMealOrderAction,
  type ActionState,
} from '@/lib/actions/orders';
import { BADMUTS_COLORS, GYM_SIZES, type OrderType } from '@db/schema';
import { ConfirmSubmit, FormMessage, SubmitButton } from './ui';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-primary';
const labelClass = 'block text-sm font-medium';

export type ChildOption = { id: string; name: string; surname: string; classroom: string };

export type OrderRow = {
  id: string;
  orderType: string;
  status: string;
  quantity: number;
  color: string | null;
  size: string | null;
  consumptionMonth: string | null;
  consumptionDates: string[];
  createdForName: string | null;
  createdAt: string;
};

/** Drink cards, swim caps and gym shirts: pick a child, then a quantity or variant. */
export function SimpleOrderForm({
  orderType,
  childOptions,
}: {
  orderType: Exclude<OrderType, 'Maaltijd'>;
  childOptions: ChildOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(placeOrderAction, null);

  return (
    <form action={action}>
      <input type="hidden" name="orderType" value={orderType} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Voor wie?
          <select name="childId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Selecteer je kind...
            </option>
            {childOptions.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name} {child.surname} ({child.classroom})
              </option>
            ))}
          </select>
        </label>

        {orderType === 'Drankkaart' ? (
          <label className={labelClass}>
            Aantal kaarten
            <input
              type="number"
              name="quantity"
              min={1}
              max={20}
              defaultValue={1}
              required
              className={inputClass}
            />
          </label>
        ) : null}

        {orderType === 'Badmuts' ? (
          <label className={labelClass}>
            Kleur
            <select name="color" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecteer de kleur...
              </option>
              {BADMUTS_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {orderType === 'Gym T-shirt' ? (
          <label className={labelClass}>
            Maat
            <select name="size" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecteer de maat...
              </option>
              {GYM_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Bestellen…">Bestellen</SubmitButton>
      </div>
    </form>
  );
}

/** Hot meals: pick a child, then tick the dates the school has opened. */
export function MealOrderForm({
  childOptions,
  openDates,
  month,
}: {
  childOptions: ChildOption[];
  openDates: string[];
  month: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(placeOrderAction, null);

  if (openDates.length === 0) {
    return (
      <p className="rounded-lg bg-canvas px-4 py-3 text-sm text-ink-muted">
        Er kunnen momenteel geen bestellingen worden geplaatst. Uitnodigingen voor bestellingen worden
        verzonden via email.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="orderType" value="Maaltijd" />

      <label className={labelClass}>
        Voor wie?
        <select name="childId" required defaultValue="" className={`${inputClass} sm:max-w-sm`}>
          <option value="" disabled>
            Selecteer je kind...
          </option>
          {childOptions.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name} {child.surname} ({child.classroom})
            </option>
          ))}
        </select>
      </label>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">
          Datums{month ? ` in ${month}` : ''} waarvoor je een warme maaltijd wil
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {openDates.map((date) => (
            <label
              key={date}
              className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="consumptionDates"
                value={date}
                className="size-4 accent-[#54363c]"
              />
              <span>{formatDayLabel(date)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Bestellen…">Bestellen</SubmitButton>
      </div>
    </form>
  );
}

export function OrderHistory({
  orders,
  openDates,
}: {
  orders: OrderRow[];
  openDates?: string[];
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-ink-muted">Je hebt nog geen bestellingen geplaatst.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {orders.map((order) => (
        <OrderHistoryItem key={order.id} order={order} openDates={openDates} />
      ))}
    </ul>
  );
}

function OrderHistoryItem({ order, openDates }: { order: OrderRow; openDates?: string[] }) {
  const [cancelState, cancelAction] = useActionState<ActionState, FormData>(cancelOrderAction, null);
  const [mealState, mealAction] = useActionState<ActionState, FormData>(updateMealOrderAction, null);

  const placed = new Date(order.createdAt);
  const cancellable = order.status === 'Besteld';

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px]">{describeOrder(order)}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Besteld op{' '}
            <time dateTime={placed.toISOString()}>
              {new Intl.DateTimeFormat('nl-BE', {
                timeZone: 'Europe/Brussels',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(placed)}
            </time>
            {order.createdForName ? ` voor ${order.createdForName}` : ''}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            order.status === 'Besteld'
              ? 'bg-warning/20 text-[#7a5c00]'
              : 'bg-success/15 text-success'
          }`}
        >
          {order.status === 'Besteld' ? 'Nog uit te delen' : order.status}
        </span>

        {cancellable ? (
          <form action={cancelAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <ConfirmSubmit variant="ghost" message="Ben je zeker dat je deze bestelling wil annuleren?">
              Annuleren
            </ConfirmSubmit>
          </form>
        ) : null}
      </div>

      {/* Meal orders stay editable while the month is open, so a parent can add or
          drop a day without cancelling and re-ordering. */}
      {order.orderType === 'Maaltijd' && cancellable && openDates && openDates.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary underline-offset-2 hover:underline">
            Datums aanpassen
          </summary>
          <form action={mealAction} className="mt-3">
            <input type="hidden" name="orderId" value={order.id} />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {openDates.map((date) => (
                <label
                  key={date}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    name="consumptionDates"
                    value={date}
                    defaultChecked={order.consumptionDates.includes(date)}
                    className="size-4 accent-[#54363c]"
                  />
                  <span>{formatDayLabel(date)}</span>
                </label>
              ))}
            </div>
            <FormMessage state={mealState} />
            <div className="mt-4">
              <SubmitButton variant="secondary" pendingLabel="Opslaan…">
                Opslaan
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : null}

      <FormMessage state={cancelState} />
    </li>
  );
}

function describeOrder(order: OrderRow): string {
  switch (order.orderType) {
    case 'Drankkaart':
      return `${order.quantity} drankkaart${order.quantity === 1 ? '' : 'en'}`;
    case 'Badmuts':
      return `Badmuts${order.color ? ` — ${order.color}` : ''}`;
    case 'Gym T-shirt':
      return `Gym T-shirt${order.size ? ` — maat ${order.size}` : ''}`;
    case 'Maaltijd':
      return `${order.consumptionDates.length} warme maaltijd${
        order.consumptionDates.length === 1 ? '' : 'en'
      }${order.consumptionMonth ? ` (${order.consumptionMonth})` : ''}: ${order.consumptionDates
        .map(formatDayLabel)
        .join(', ')}`;
    default:
      return order.orderType;
  }
}

/** '2026-09-15' → 'di 15 sep'. Falls back to the raw value for legacy formats. */
function formatDayLabel(value: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}
