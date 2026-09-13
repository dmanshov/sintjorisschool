'use client';

import { useActionState, useState } from 'react';
import {
  addChildAction,
  removeChildAction,
  updateChildAction,
  updateProfileAction,
  type ActionState,
} from '@/lib/actions/children';
import { changePasswordAction, type FormState } from '@/lib/auth/actions';
import { CLASSROOMS } from '@db/schema';
import { ConfirmSubmit, FormMessage, SubmitButton } from './ui';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] focus:border-primary';
const labelClass = 'block text-sm font-medium';

export type ChildRow = { id: string; name: string; surname: string; classroom: string };

export function ProfileDetailsForm({
  displayName,
  surname,
  phoneNumber,
  email,
}: {
  displayName: string;
  surname: string;
  phoneNumber: string;
  email: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, null);

  return (
    <form action={action} className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Jouw gegevens</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Aangemeld als <span className="font-medium text-ink">{email}</span>
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Jouw voornaam
          <input
            name="displayName"
            defaultValue={displayName}
            autoComplete="given-name"
            placeholder="Wat is jouw voornaam?"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Jouw familienaam
          <input
            name="surname"
            defaultValue={surname}
            autoComplete="family-name"
            placeholder="Wat is jouw familienaam?"
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Telefoonnummer <span className="font-normal text-ink-muted">(optioneel)</span>
          <input
            name="phoneNumber"
            type="tel"
            defaultValue={phoneNumber}
            autoComplete="tel"
            placeholder="Bijvoorbeeld 0470 12 34 56"
            className={inputClass}
          />
        </label>
      </div>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </div>
    </form>
  );
}

export function AddChildForm() {
  const [state, action] = useActionState<ActionState, FormData>(addChildAction, null);

  return (
    <form action={action} className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Voeg een kind toe aan je gezin</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Je kan enkel bestellen voor kinderen die in je gezin staan.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Voornaam
          <input name="name" required placeholder="Voornaam van je kind" className={inputClass} />
        </label>
        <label className={labelClass}>
          Familienaam
          <input name="surname" placeholder="Familienaam van je kind" className={inputClass} />
        </label>
        <label className={labelClass}>
          Klas
          <select name="classroom" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Klas van je kind
            </option>
            {CLASSROOMS.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Toevoegen…">Toevoegen</SubmitButton>
      </div>
    </form>
  );
}

export function ChildListItem({ child }: { child: ChildRow }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction] = useActionState<ActionState, FormData>(updateChildAction, null);
  const [removeState, removeAction] = useActionState<ActionState, FormData>(removeChildAction, null);

  return (
    <li className="card p-5">
      {editing ? (
        <form action={updateAction}>
          <input type="hidden" name="childId" value={child.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Voornaam
              <input name="name" defaultValue={child.name} required className={inputClass} />
            </label>
            <label className={labelClass}>
              Familienaam
              <input name="surname" defaultValue={child.surname} className={inputClass} />
            </label>
            <label className={labelClass}>
              Klas
              <select name="classroom" defaultValue={child.classroom} className={inputClass}>
                {CLASSROOMS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <FormMessage state={updateState} />

          <div className="mt-4 flex flex-wrap gap-2">
            <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-4 py-2.5 text-sm text-ink-muted hover:text-primary"
            >
              Annuleren
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="font-display text-lg font-medium">
              {child.name} {child.surname}
            </p>
            <p className="text-sm text-ink-muted">Klas {child.classroom}</p>
          </div>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-primary hover:text-primary"
          >
            Gegevens aanpassen
          </button>

          <form action={removeAction}>
            <input type="hidden" name="childId" value={child.id} />
            <ConfirmSubmit
              variant="ghost"
              message={`Ben je zeker dat je ${child.name} wil verwijderen uit het gezin?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </form>
        </div>
      )}

      <FormMessage state={removeState} />
    </li>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, null);

  return (
    <form action={action} className="card p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Wachtwoord wijzigen</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Huidig wachtwoord
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Nieuw wachtwoord
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Herhaal nieuw wachtwoord
          <input
            type="password"
            name="passwordConfirm"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>

      <FormMessage state={state} />

      <div className="mt-5">
        <SubmitButton pendingLabel="Opslaan…">Wachtwoord wijzigen</SubmitButton>
      </div>
    </form>
  );
}
