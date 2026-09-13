'use client';

import { useActionState, useState } from 'react';
import {
  addMealDateAction,
  closeMealOrdersAction,
  removeMealDateAction,
  setMealMonthAction,
  updateContentFieldsAction,
  uploadBenodigdhedenAction,
  uploadMealMenuAction,
  type ActionState as ContentActionState,
} from '@/lib/actions/content';
import {
  bulkSetOrderStatusAction,
  resyncOpenOrderClassroomsAction,
  setOrderStatusAction,
  type ActionState as OrderActionState,
} from '@/lib/actions/orders';
import {
  createPostAction,
  deletePostAction,
  setPostPinnedAction,
  updatePostAction,
  type ActionState as PostActionState,
} from '@/lib/actions/posts';
import { setUserDisabledAction, updateUserRightsAction, type ActionState as UserActionState } from '@/lib/actions/users';
import { CLASSROOMS, POST_CLASSROOMS, type OrderStatus, type OrderType } from '@db/schema';
import { ConfirmSubmit, FormMessage, SubmitButton } from './ui';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-primary';
const labelClass = 'block text-sm font-medium';

// ─────────────────────────────────────────────────────────────────────────────
// User rights
// ─────────────────────────────────────────────────────────────────────────────
export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  surname: string | null;
  admin: boolean;
  teacher: boolean;
  teacherClassroom: string[];
  onLegacyPassword: boolean;
  disabled?: boolean;
};

export function UserRightsRow({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<UserActionState, FormData>(updateUserRightsAction, null);
  const [blockState, blockAction] = useActionState<UserActionState, FormData>(
    setUserDisabledAction,
    null,
  );
  const [teacher, setTeacher] = useState(user.teacher);

  const name = [user.displayName, user.surname].filter(Boolean).join(' ') || 'Naam onbekend';

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">
            {name}
            {isSelf ? <span className="ml-2 text-xs text-ink-muted">(jij)</span> : null}
          </p>
          <p className="truncate text-sm text-ink-muted">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {user.admin ? <Badge tone="primary">Administrator</Badge> : null}
          {user.teacher ? (
            <Badge tone="secondary">
              Leerkracht{user.teacherClassroom.length > 0 ? ` · ${user.teacherClassroom.join(', ')}` : ''}
            </Badge>
          ) : null}
          {user.disabled ? <Badge tone="danger">Geblokkeerd</Badge> : null}
          {user.onLegacyPassword ? (
            <Badge tone="muted" title="Heeft sinds de overstap nog niet ingelogd">
              Oud wachtwoord
            </Badge>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-primary hover:text-primary"
        >
          Rechten
        </button>
      </div>

      {open ? (
        <div className="mt-4 rounded-lg bg-canvas p-4">
          <form action={action}>
            <input type="hidden" name="userId" value={user.id} />

            <p className="text-sm font-medium">Rechten aanpassen voor {user.email}</p>

            <label className="mt-3 flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="admin"
                defaultChecked={user.admin}
                className="size-4 accent-[#54363c]"
              />
              Administrator — volledige toegang tot dit beheerscherm
            </label>

            <label className="mt-2 flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="teacher"
                checked={teacher}
                onChange={(event) => setTeacher(event.target.checked)}
                className="size-4 accent-[#54363c]"
              />
              Leerkracht — kan artikels publiceren en bestellingen van de eigen klas beheren
            </label>

            {teacher ? (
              <fieldset className="mt-3">
                <legend className="text-sm font-medium">Klas(sen)</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CLASSROOMS.map((room) => (
                    <label
                      key={room}
                      className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name="teacherClassroom"
                        value={room}
                        defaultChecked={user.teacherClassroom.includes(room)}
                        className="size-4 accent-[#54363c]"
                      />
                      {room}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <FormMessage state={state} />

            <div className="mt-4 flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
            </div>
          </form>

          {!isSelf ? (
            <form action={blockAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="disabled" value={user.disabled ? 'false' : 'true'} />
              <ConfirmSubmit
                variant={user.disabled ? 'secondary' : 'danger'}
                message={
                  user.disabled
                    ? 'Dit profiel opnieuw activeren?'
                    : 'Dit profiel blokkeren? De gebruiker wordt onmiddellijk afgemeld en kan niet meer inloggen.'
                }
              >
                {user.disabled ? 'Opnieuw activeren' : 'Profiel blokkeren'}
              </ConfirmSubmit>
              <FormMessage state={blockState} />
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Badge({
  children,
  tone,
  title,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'secondary' | 'danger' | 'muted';
  title?: string;
}) {
  const styles = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/15 text-secondary',
    danger: 'bg-danger/10 text-danger',
    muted: 'bg-canvas text-ink-muted',
  }[tone];
  return (
    <span title={title} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────
export function BulkStatusForm({
  orderType,
  from,
  to,
  label,
  confirmMessage,
  consumptionMonth,
}: {
  orderType: OrderType;
  from: OrderStatus;
  to: OrderStatus;
  label: string;
  confirmMessage: string;
  consumptionMonth?: string | null;
}) {
  const [state, action] = useActionState<OrderActionState, FormData>(bulkSetOrderStatusAction, null);

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="orderType" value={orderType} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      {consumptionMonth ? <input type="hidden" name="consumptionMonth" value={consumptionMonth} /> : null}
      <ConfirmSubmit variant="secondary" message={confirmMessage}>
        {label}
      </ConfirmSubmit>
      <FormMessage state={state} />
    </form>
  );
}

export function OrderStatusToggle({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [state, action] = useActionState<OrderActionState, FormData>(setOrderStatusAction, null);
  const next: OrderStatus = status === 'Besteld' ? 'Uitgedeeld' : 'Besteld';

  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton variant="ghost" pendingLabel="…">
        {status === 'Besteld' ? 'Markeer als uitgedeeld' : 'Terug naar besteld'}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ResyncClassroomsButton() {
  const [state, action] = useActionState<OrderActionState, FormData>(
    async () => resyncOpenOrderClassroomsAction(),
    null,
  );

  return (
    <form action={action}>
      <SubmitButton variant="ghost" pendingLabel="Bijwerken…">
        Klassen van open bestellingen bijwerken
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Meals
// ─────────────────────────────────────────────────────────────────────────────
export function MealAdminPanel({
  month,
  openDates,
  menus,
}: {
  month: string | null;
  openDates: string[];
  menus: string[];
}) {
  const [monthState, monthAction] = useActionState<ContentActionState, FormData>(setMealMonthAction, null);
  const [addState, addAction] = useActionState<ContentActionState, FormData>(addMealDateAction, null);
  const [removeState, removeAction] = useActionState<ContentActionState, FormData>(
    removeMealDateAction,
    null,
  );
  const [closeState, closeAction] = useActionState<ContentActionState, FormData>(
    async () => closeMealOrdersAction(),
    null,
  );
  const [uploadState, uploadAction] = useActionState<ContentActionState, FormData>(
    uploadMealMenuAction,
    null,
  );

  return (
    <div className="space-y-5">
      <form action={monthAction}>
        <label className={labelClass}>
          Bestelmaand
          <input
            name="maaltijdMaand"
            defaultValue={month ?? ''}
            placeholder="Bijvoorbeeld: Oktober 2026"
            className={`${inputClass} sm:max-w-xs`}
          />
        </label>
        <FormMessage state={monthState} />
        <div className="mt-3">
          <SubmitButton pendingLabel="Opslaan…">Bestelmaand opslaan</SubmitButton>
        </div>
      </form>

      <div className="border-t border-line pt-5">
        <h4 className="text-sm font-semibold">
          Datums waarvoor momenteel bestellingen kunnen worden geplaatst
        </h4>

        {openDates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Er kunnen momenteel geen bestellingen worden geplaatst.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {openDates.map((date) => (
              <li key={date}>
                <form action={removeAction} className="flex items-center gap-1 rounded-lg bg-canvas px-3 py-1.5">
                  <input type="hidden" name="date" value={date} />
                  <span className="text-sm">{date}</span>
                  <ConfirmSubmit
                    variant="ghost"
                    className="!px-1.5 !py-0.5 text-xs"
                    message={`Datum ${date} sluiten voor bestellingen?`}
                  >
                    ✕
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        <FormMessage state={removeState} />

        <form action={addAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Datum openstellen
            <input type="date" name="date" required className={inputClass} />
          </label>
          <SubmitButton pendingLabel="Toevoegen…">Toevoegen</SubmitButton>
        </form>
        <FormMessage state={addState} />

        {openDates.length > 0 ? (
          <form action={closeAction} className="mt-4">
            <ConfirmSubmit
              variant="danger"
              message="Ben je zeker dat je alle bestellingen wil afsluiten? Ouders kunnen daarna geen maaltijden meer bestellen."
            >
              Bestellingen afsluiten
            </ConfirmSubmit>
            <FormMessage state={closeState} />
          </form>
        ) : null}
      </div>

      <div className="border-t border-line pt-5">
        <h4 className="text-sm font-semibold">Maandmenu</h4>
        {menus.length > 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Huidig menu:{' '}
            <a
              href={menus[menus.length - 1]}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline-offset-2 hover:underline"
            >
              openen
            </a>{' '}
            ({menus.length} opgeladen)
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">Er is nog geen menu opgeladen.</p>
        )}

        <form action={uploadAction} className="mt-3 flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Nieuw menu (PDF)
            <input type="file" name="menu" accept="application/pdf" required className={inputClass} />
          </label>
          <SubmitButton pendingLabel="Opladen…">Maandmenu opladen</SubmitButton>
        </form>
        <FormMessage state={uploadState} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Schoolkrant
// ─────────────────────────────────────────────────────────────────────────────
export type EditablePost = {
  id: string;
  postTitle: string;
  postDescription: string;
  postPhoto: string | null;
  albumUrl: string | null;
  externalUrl: string | null;
  classroom: string[];
  pinned: boolean;
};

export function PostEditor({
  post,
  allowedClassrooms,
  onDone,
}: {
  post?: EditablePost;
  allowedClassrooms: readonly string[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState<PostActionState, FormData>(
    post ? updatePostAction : createPostAction,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      {post ? <input type="hidden" name="postId" value={post.id} /> : null}

      <label className={labelClass}>
        Titel
        <input
          name="postTitle"
          defaultValue={post?.postTitle ?? ''}
          required
          maxLength={200}
          placeholder="Schrijf een korte, duidelijke titel"
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Beschrijving
        <textarea
          name="postDescription"
          defaultValue={post?.postDescription ?? ''}
          rows={7}
          placeholder="Schrijf hier de inhoud van je artikel"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Link naar foto-album <span className="font-normal text-ink-muted">(optioneel)</span>
          <input
            name="albumUrl"
            type="url"
            defaultValue={post?.albumUrl ?? ''}
            placeholder="https://"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Externe link <span className="font-normal text-ink-muted">(optioneel)</span>
          <input
            name="externalUrl"
            type="url"
            defaultValue={post?.externalUrl ?? ''}
            placeholder="https://"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Artikel-foto opladen <span className="font-normal text-ink-muted">(optioneel)</span>
          <input type="file" name="photo" accept="image/*" className={inputClass} />
        </label>
        <label className={labelClass}>
          …of een link naar een foto
          <input
            name="photoUrl"
            type="url"
            defaultValue={post?.postPhoto ?? ''}
            placeholder="https://"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset>
        <legend className={labelClass}>Voor welke klassen geldt dit artikel?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {POST_CLASSROOMS.filter((room) => allowedClassrooms.includes(room)).map((room) => (
            <label
              key={room}
              className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="classroom"
                value={room}
                defaultChecked={post?.classroom.includes(room) ?? false}
                className="size-4 accent-[#54363c]"
              />
              {room}
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Opslaan…">{post ? 'Opslaan' : 'Publiceren'}</SubmitButton>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg px-4 py-2.5 text-sm text-ink-muted hover:text-primary"
          >
            Annuleren
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function PostAdminRow({
  post,
  allowedClassrooms,
}: {
  post: EditablePost & { timePosted: string; authorName: string | null };
  allowedClassrooms: readonly string[];
}) {
  const [editing, setEditing] = useState(false);
  const [pinState, pinAction] = useActionState<PostActionState, FormData>(setPostPinnedAction, null);
  const [deleteState, deleteAction] = useActionState<PostActionState, FormData>(deletePostAction, null);

  return (
    <li className="card p-5">
      {editing ? (
        <PostEditor post={post} allowedClassrooms={allowedClassrooms} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-medium">{post.postTitle}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {new Intl.DateTimeFormat('nl-BE', {
                  timeZone: 'Europe/Brussels',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(post.timePosted))}
                {post.authorName ? ` · ${post.authorName}` : ''} · {post.classroom.join(', ')}
              </p>
            </div>
            {post.pinned ? <Badge tone="secondary">Op de homepage</Badge> : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-primary hover:text-primary"
            >
              Aanpassen
            </button>

            <form action={pinAction}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="pinned" value={post.pinned ? 'false' : 'true'} />
              <ConfirmSubmit
                variant="ghost"
                message={
                  post.pinned
                    ? 'Ben je zeker dat je dit artikel niet langer op de homepage wil plaatsen?'
                    : 'Dit artikel op de homepage vastpinnen?'
                }
              >
                {post.pinned ? 'Losmaken van homepage' : 'Vastpinnen op homepage'}
              </ConfirmSubmit>
            </form>

            <form action={deleteAction}>
              <input type="hidden" name="postId" value={post.id} />
              <ConfirmSubmit message="Ben je zeker dat je dit artikel wil verwijderen?">
                Verwijderen
              </ConfirmSubmit>
            </form>
          </div>

          <FormMessage state={pinState} />
          <FormMessage state={deleteState} />
        </>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS
// ─────────────────────────────────────────────────────────────────────────────
export function ContentGroupForm({
  title,
  fields,
}: {
  title: string;
  fields: Array<{ name: string; label: string; multiline: boolean; value: string }>;
}) {
  const [state, action] = useActionState<ContentActionState, FormData>(updateContentFieldsAction, null);

  return (
    <form action={action} className="card p-5 sm:p-6">
      <h3 className="font-display text-lg font-semibold">{title}</h3>

      <div className="mt-4 space-y-4">
        {fields.map((field) => (
          <label key={field.name} className={labelClass}>
            {field.label}
            {field.multiline ? (
              <textarea name={field.name} defaultValue={field.value} rows={5} className={inputClass} />
            ) : (
              <input name={field.name} defaultValue={field.value} className={inputClass} />
            )}
          </label>
        ))}
      </div>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </div>
    </form>
  );
}

export function BenodigdhedenUpload({ field, label }: { field: string; label: string }) {
  const [state, action] = useActionState<ContentActionState, FormData>(
    uploadBenodigdhedenAction,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="field" value={field} />
      <label className={labelClass}>
        {label} (PDF)
        <input type="file" name="document" accept="application/pdf" required className={inputClass} />
      </label>
      <SubmitButton variant="secondary" pendingLabel="Opladen…">
        Opladen
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
