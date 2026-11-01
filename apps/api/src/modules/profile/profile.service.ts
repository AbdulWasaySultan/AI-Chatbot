// Business profile: the verified facts agents are allowed to state (plans/05 §3.2).
// PUT replaces the whole profile in one transaction so it is never half-updated.
import { asc, eq } from 'drizzle-orm';
import type { BusinessProfileInput } from '@fj/shared';
import { withSystemTx, withWorkspaceTx, type Db, type Tx } from '../../db/client.ts';
import {
  businessProfiles,
  contactsDirectory,
  hoursExceptions,
  locations,
  openingHours,
  policies,
  services,
} from '../../db/schema.ts';
import { uuidv7 } from '../../lib/ids.ts';
import type { WorkspaceContext } from '../../http/context.ts';
import { writeAudit } from '../audit.ts';

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : undefined);

export async function readProfile(tx: Tx, workspaceId: string): Promise<BusinessProfileInput> {
  const [bp] = await tx.select().from(businessProfiles).where(eq(businessProfiles.workspaceId, workspaceId));
  const locs = await tx.select().from(locations).where(eq(locations.workspaceId, workspaceId)).orderBy(asc(locations.position));
  const hours = await tx.select().from(openingHours).where(eq(openingHours.workspaceId, workspaceId));
  const exceptions = await tx.select().from(hoursExceptions).where(eq(hoursExceptions.workspaceId, workspaceId));
  const contacts = await tx.select().from(contactsDirectory).where(eq(contactsDirectory.workspaceId, workspaceId));
  const svc = await tx.select().from(services).where(eq(services.workspaceId, workspaceId)).orderBy(asc(services.position));
  const pol = await tx.select().from(policies).where(eq(policies.workspaceId, workspaceId));
  const locIndex = new Map(locs.map((l, i) => [l.id, i]));

  return {
    displayName: bp?.displayName ?? '',
    legalName: bp?.legalName ?? '',
    description: bp?.description ?? '',
    websiteUrl: bp?.websiteUrl ?? '',
    primaryPhone: bp?.primaryPhone ?? '',
    primaryEmail: bp?.primaryEmail ?? '',
    serviceAreas: bp?.serviceAreas ?? [],
    locations: locs.map((l) => ({
      name: l.name,
      isPrimary: l.isPrimary,
      street: l.street,
      city: l.city,
      region: l.region,
      postalCode: l.postalCode,
      country: l.country,
      phone: l.phone,
      email: l.email,
      mapsUrl: l.mapsUrl,
      notes: l.notes,
      hoursConfigured: l.hoursConfigured,
      hours: hours
        .filter((h) => h.locationId === l.id)
        .sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens))
        .map((h) => ({ weekday: h.weekday, opens: hhmm(h.opens)!, closes: hhmm(h.closes)! })),
    })),
    hoursExceptions: exceptions.map((e) => ({
      ...(e.locationId && locIndex.has(e.locationId) ? { locationIndex: locIndex.get(e.locationId)! } : {}),
      date: e.date,
      closed: e.closed,
      opens: hhmm(e.opens),
      closes: hhmm(e.closes),
      label: e.label,
    })),
    contacts: contacts.map((c) => ({
      kind: c.kind as BusinessProfileInput['contacts'][number]['kind'],
      name: c.name,
      role: c.role,
      phone: c.phone,
      email: c.email,
      available24x7: c.available24x7,
      notify: c.notify,
      priority: c.priority,
    })),
    services: svc.map((s) => ({
      name: s.name,
      description: s.description,
      priceType: s.priceType as BusinessProfileInput['services'][number]['priceType'],
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      currency: s.currency,
      durationMinutes: s.durationMinutes,
      bookable: s.bookable,
      active: s.active,
    })),
    policies: pol.map((p) => ({
      topic: p.topic as BusinessProfileInput['policies'][number]['topic'],
      title: p.title,
      body: p.body,
    })),
  };
}

export async function writeProfile(tx: Tx, workspaceId: string, input: BusinessProfileInput, userId: string | null) {
  // Exactly one primary location when any exist.
  const locs = input.locations.map((l, i) => ({ ...l, isPrimary: false, _i: i }));
  const primaryIndex = Math.max(0, input.locations.findIndex((l) => l.isPrimary));
  if (locs[primaryIndex]) locs[primaryIndex]!.isPrimary = true;

  await tx
    .insert(businessProfiles)
    .values({
      workspaceId,
      displayName: input.displayName,
      legalName: input.legalName,
      description: input.description,
      websiteUrl: input.websiteUrl,
      primaryPhone: input.primaryPhone,
      primaryEmail: input.primaryEmail,
      serviceAreas: input.serviceAreas,
      updatedBy: userId,
    })
    .onConflictDoUpdate({
      target: businessProfiles.workspaceId,
      set: {
        displayName: input.displayName,
        legalName: input.legalName,
        description: input.description,
        websiteUrl: input.websiteUrl,
        primaryPhone: input.primaryPhone,
        primaryEmail: input.primaryEmail,
        serviceAreas: input.serviceAreas,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });

  // Replace child rows. Deleting locations cascades to their opening hours and exceptions.
  await tx.delete(hoursExceptions).where(eq(hoursExceptions.workspaceId, workspaceId));
  await tx.delete(locations).where(eq(locations.workspaceId, workspaceId));
  await tx.delete(contactsDirectory).where(eq(contactsDirectory.workspaceId, workspaceId));
  await tx.delete(services).where(eq(services.workspaceId, workspaceId));
  await tx.delete(policies).where(eq(policies.workspaceId, workspaceId));

  const locationIds: string[] = [];
  for (const l of locs) {
    const id = uuidv7();
    locationIds.push(id);
    await tx.insert(locations).values({
      id,
      workspaceId,
      name: l.name,
      isPrimary: l.isPrimary,
      street: l.street,
      city: l.city,
      region: l.region,
      postalCode: l.postalCode,
      country: l.country,
      phone: l.phone,
      email: l.email,
      mapsUrl: l.mapsUrl,
      notes: l.notes,
      hoursConfigured: l.hoursConfigured || l.hours.length > 0,
      position: l._i,
    });
    if (l.hours.length) {
      await tx.insert(openingHours).values(
        l.hours.map((h) => ({ id: uuidv7(), workspaceId, locationId: id, weekday: h.weekday, opens: h.opens, closes: h.closes }))
      );
    }
  }
  if (input.hoursExceptions.length) {
    await tx.insert(hoursExceptions).values(
      input.hoursExceptions.map((e) => ({
        id: uuidv7(),
        workspaceId,
        locationId: e.locationIndex !== undefined ? (locationIds[e.locationIndex] ?? null) : null,
        date: e.date,
        closed: e.closed,
        opens: e.closed ? null : (e.opens ?? null),
        closes: e.closed ? null : (e.closes ?? null),
        label: e.label,
      }))
    );
  }
  if (input.contacts.length) {
    await tx.insert(contactsDirectory).values(input.contacts.map((c) => ({ id: uuidv7(), workspaceId, ...c })));
  }
  if (input.services.length) {
    await tx.insert(services).values(input.services.map((s, i) => ({ id: uuidv7(), workspaceId, position: i, ...s })));
  }
  if (input.policies.length) {
    await tx.insert(policies).values(input.policies.map((p) => ({ id: uuidv7(), workspaceId, ...p })));
  }
}

export function createProfileService(db: Db) {
  return {
    get: (ctx: WorkspaceContext) => withWorkspaceTx(db, ctx.workspaceId, (tx) => readProfile(tx, ctx.workspaceId)),

    async replace(ctx: WorkspaceContext, input: BusinessProfileInput) {
      const saved = await withWorkspaceTx(db, ctx.workspaceId, async (tx) => {
        await writeProfile(tx, ctx.workspaceId, input, ctx.userId);
        return readProfile(tx, ctx.workspaceId);
      });
      await withSystemTx(db, (tx) =>
        writeAudit(tx, {
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          actorUserId: ctx.userId,
          action: 'profile.replaced',
          targetType: 'business_profile',
          targetId: ctx.workspaceId,
          data: { locations: input.locations.length, services: input.services.length, contacts: input.contacts.length },
        })
      );
      return saved;
    },
  };
}
