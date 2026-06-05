"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";

const FROM         = process.env.EMAIL_FROM;
const PASS         = process.env.GMAIL_APP_PASSWORD;
const SAM_EMAIL    = "sam@oakridgeelectrical.com";
const JUSTIN_EMAIL = "justin@oakridgeelectrical.com";

function getTransport() {
  if (!FROM || !PASS) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: FROM, pass: PASS },
  });
}

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LightingItemInput {
  typeLabel?:     string | null;
  tag?:           string | null;
  fixtureType?:   string | null;
  description?:   string | null;
  markup?:        number;
  manufacturer?:  string | null;
  catalogNumber?: string | null;
  volts?:         string | null;
  watts?:         number | null;
  lampType?:      string | null;
  mounting?:      string | null;
  location?:      string | null;
  qty?:           number;
  supplier?:      string | null;
  supplierEmail?: string | null;
  quotedPrice?:   number | null;
  quoteStatus?:   string | null;
  notes?:         string | null;
  sortOrder?:     number;
}

export interface GearItemInput {
  tag?:           string | null;
  gearType?:      string | null;
  description?:   string | null;
  markup?:        number;
  manufacturer?:  string | null;
  catalogNumber?: string | null;
  volts?:         string | null;
  amps?:          number | null;
  phases?:        number | null;
  location?:      string | null;
  qty?:           number;
  supplier?:      string | null;
  supplierEmail?: string | null;
  quotedPrice?:   number | null;
  quoteStatus?:   string | null;
  notes?:         string | null;
  sortOrder?:     number;
}

// ── Lighting Schedule ─────────────────────────────────────────────────────────

export async function getLightingSchedule(jobId: string) {
  await requireActive();
  return prisma.lightingScheduleItem.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function addLightingItem(jobId: string, input: LightingItemInput) {
  await requireActive();
  const item = await prisma.lightingScheduleItem.create({
    data: {
      jobId,
      typeLabel:     input.typeLabel     ?? null,
      tag:           input.tag           ?? null,
      fixtureType:   input.fixtureType   ?? null,
      description:   input.description   ?? null,
      markup:        input.markup        ?? 0.05,
      manufacturer:  input.manufacturer  ?? null,
      catalogNumber: input.catalogNumber ?? null,
      volts:         input.volts         ?? null,
      watts:         input.watts         ?? null,
      lampType:      input.lampType      ?? null,
      mounting:      input.mounting      ?? null,
      location:      input.location      ?? null,
      qty:           input.qty           ?? 0,
      supplier:      input.supplier      ?? null,
      supplierEmail: input.supplierEmail ?? null,
      quotedPrice:   input.quotedPrice   ?? null,
      quoteStatus:   input.quoteStatus   ?? "PENDING",
      notes:         input.notes         ?? null,
      sortOrder:     input.sortOrder     ?? 0,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
  return item;
}

export async function updateLightingItem(id: string, input: Partial<LightingItemInput>) {
  await requireActive();
  const item = await prisma.lightingScheduleItem.update({
    where: { id },
    data: {
      ...(input.typeLabel     !== undefined && { typeLabel:     input.typeLabel }),
      ...(input.tag           !== undefined && { tag:           input.tag }),
      ...(input.fixtureType   !== undefined && { fixtureType:   input.fixtureType }),
      ...(input.description   !== undefined && { description:   input.description }),
      ...(input.markup        !== undefined && { markup:        input.markup }),
      ...(input.manufacturer  !== undefined && { manufacturer:  input.manufacturer }),
      ...(input.catalogNumber !== undefined && { catalogNumber: input.catalogNumber }),
      ...(input.volts         !== undefined && { volts:         input.volts }),
      ...(input.watts         !== undefined && { watts:         input.watts }),
      ...(input.lampType      !== undefined && { lampType:      input.lampType }),
      ...(input.mounting      !== undefined && { mounting:      input.mounting }),
      ...(input.location      !== undefined && { location:      input.location }),
      ...(input.qty           !== undefined && { qty:           input.qty }),
      ...(input.supplier      !== undefined && { supplier:      input.supplier }),
      ...(input.supplierEmail !== undefined && { supplierEmail: input.supplierEmail }),
      ...(input.quotedPrice   !== undefined && { quotedPrice:   input.quotedPrice }),
      ...(input.quoteStatus   !== undefined && { quoteStatus:   input.quoteStatus }),
      ...(input.notes         !== undefined && { notes:         input.notes }),
      ...(input.sortOrder     !== undefined && { sortOrder:     input.sortOrder }),
    },
  });
  revalidatePath(`/jobs/${item.jobId}`);
  return item;
}

export async function deleteLightingItem(id: string) {
  await requireActive();
  const item = await prisma.lightingScheduleItem.delete({ where: { id } });
  revalidatePath(`/jobs/${item.jobId}`);
}

export async function updateLightingQty(id: string, qty: number) {
  await requireActive();
  const item = await prisma.lightingScheduleItem.update({
    where: { id },
    data: { qty },
  });
  revalidatePath(`/jobs/${item.jobId}`);
  return item;
}

// ── Gear Schedule ─────────────────────────────────────────────────────────────

export async function getGearSchedule(jobId: string) {
  await requireActive();
  return prisma.gearScheduleItem.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function addGearItem(jobId: string, input: GearItemInput) {
  await requireActive();
  const item = await prisma.gearScheduleItem.create({
    data: {
      jobId,
      tag:           input.tag           ?? null,
      gearType:      input.gearType      ?? null,
      description:   input.description   ?? null,
      markup:        input.markup        ?? 0.05,
      manufacturer:  input.manufacturer  ?? null,
      catalogNumber: input.catalogNumber ?? null,
      volts:         input.volts         ?? null,
      amps:          input.amps          ?? null,
      phases:        input.phases        ?? null,
      location:      input.location      ?? null,
      qty:           input.qty           ?? 0,
      supplier:      input.supplier      ?? null,
      supplierEmail: input.supplierEmail ?? null,
      quotedPrice:   input.quotedPrice   ?? null,
      quoteStatus:   input.quoteStatus   ?? "PENDING",
      notes:         input.notes         ?? null,
      sortOrder:     input.sortOrder     ?? 0,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
  return item;
}

export async function updateGearItem(id: string, input: Partial<GearItemInput>) {
  await requireActive();
  const item = await prisma.gearScheduleItem.update({
    where: { id },
    data: {
      ...(input.tag           !== undefined && { tag:           input.tag }),
      ...(input.gearType      !== undefined && { gearType:      input.gearType }),
      ...(input.description   !== undefined && { description:   input.description }),
      ...(input.markup        !== undefined && { markup:        input.markup }),
      ...(input.manufacturer  !== undefined && { manufacturer:  input.manufacturer }),
      ...(input.catalogNumber !== undefined && { catalogNumber: input.catalogNumber }),
      ...(input.volts         !== undefined && { volts:         input.volts }),
      ...(input.amps          !== undefined && { amps:          input.amps }),
      ...(input.phases        !== undefined && { phases:        input.phases }),
      ...(input.location      !== undefined && { location:      input.location }),
      ...(input.qty           !== undefined && { qty:           input.qty }),
      ...(input.supplier      !== undefined && { supplier:      input.supplier }),
      ...(input.supplierEmail !== undefined && { supplierEmail: input.supplierEmail }),
      ...(input.quotedPrice   !== undefined && { quotedPrice:   input.quotedPrice }),
      ...(input.quoteStatus   !== undefined && { quoteStatus:   input.quoteStatus }),
      ...(input.notes         !== undefined && { notes:         input.notes }),
      ...(input.sortOrder     !== undefined && { sortOrder:     input.sortOrder }),
    },
  });
  revalidatePath(`/jobs/${item.jobId}`);
  return item;
}

export async function deleteGearItem(id: string) {
  await requireActive();
  const item = await prisma.gearScheduleItem.delete({ where: { id } });
  revalidatePath(`/jobs/${item.jobId}`);
}

// ── Quote Emails ──────────────────────────────────────────────────────────────

export async function sendLightingQuoteRequest(
  jobId: string,
  itemIds: string[],
  supplierName: string,
  supplierEmail: string,
  message?: string,
) {
  await requireActive();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { jobName: true, jobNumber: true },
  });
  if (!job) throw new Error("Job not found");

  const items = await prisma.lightingScheduleItem.findMany({
    where: { id: { in: itemIds.length > 0 ? itemIds : undefined }, jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const itemLines = items.map(it => {
    const parts = [
      it.tag          ? `[${it.tag}]`              : null,
      it.fixtureType  ?? null,
      it.description  ?? null,
      it.manufacturer ? `Mfr: ${it.manufacturer}` : null,
      it.catalogNumber ? `Cat#: ${it.catalogNumber}` : null,
      it.volts        ? `${it.volts}V`             : null,
      it.watts        ? `${it.watts}W`             : null,
      it.mounting     ? `Mtg: ${it.mounting}`      : null,
      it.location     ? `Loc: ${it.location}`      : null,
    ].filter(Boolean).join(" | ");
    return `• Qty ${it.qty} — ${parts || "(no description)"}`;
  }).join("\n");

  const body = [
    `Dear ${supplierName},`,
    "",
    `Please provide pricing on the following lighting fixtures for:`,
    `Job: ${job.jobName}  (Job #${job.jobNumber})`,
    "",
    "FIXTURE SCHEDULE:",
    itemLines,
    "",
    ...(message ? [message, ""] : []),
    "Thank you,",
    "Oak Ridge Electrical LLC — Justin Marceau, Owner",
    "603-660-4651 | Justin@oakridgeelectrical.com",
  ].join("\n");

  const transport = getTransport();
  if (transport) {
    await transport.sendMail({
      from: `"Oak Ridge Electrical" <${FROM}>`,
      to:   supplierEmail,
      cc:   [SAM_EMAIL, JUSTIN_EMAIL].join(", "),
      subject: `Lighting Quote Request — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`,
      text: body,
    });
  }

  // Mark items as QUOTED
  await prisma.lightingScheduleItem.updateMany({
    where: { id: { in: items.map(i => i.id) } },
    data:  { quoteStatus: "QUOTED", supplier: supplierName, supplierEmail },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function sendGearQuoteRequest(
  jobId: string,
  itemIds: string[],
  supplierName: string,
  supplierEmail: string,
  message?: string,
) {
  await requireActive();

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { jobName: true, jobNumber: true },
  });
  if (!job) throw new Error("Job not found");

  const items = await prisma.gearScheduleItem.findMany({
    where: { id: { in: itemIds.length > 0 ? itemIds : undefined }, jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const itemLines = items.map(it => {
    const parts = [
      it.tag          ? `[${it.tag}]`              : null,
      it.gearType     ?? null,
      it.description  ?? null,
      it.manufacturer ? `Mfr: ${it.manufacturer}` : null,
      it.catalogNumber ? `Cat#: ${it.catalogNumber}` : null,
      it.volts        ? `${it.volts}V`             : null,
      it.amps         ? `${it.amps}A`              : null,
      it.phases       ? `${it.phases}Ø`            : null,
      it.location     ? `Loc: ${it.location}`      : null,
    ].filter(Boolean).join(" | ");
    return `• Qty ${it.qty} — ${parts || "(no description)"}`;
  }).join("\n");

  const body = [
    `Dear ${supplierName},`,
    "",
    `Please provide pricing on the following electrical gear for:`,
    `Job: ${job.jobName}  (Job #${job.jobNumber})`,
    "",
    "GEAR SCHEDULE:",
    itemLines,
    "",
    ...(message ? [message, ""] : []),
    "Thank you,",
    "Oak Ridge Electrical LLC — Justin Marceau, Owner",
    "603-660-4651 | Justin@oakridgeelectrical.com",
  ].join("\n");

  const transport = getTransport();
  if (transport) {
    await transport.sendMail({
      from: `"Oak Ridge Electrical" <${FROM}>`,
      to:   supplierEmail,
      cc:   [SAM_EMAIL, JUSTIN_EMAIL].join(", "),
      subject: `Gear Quote Request — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`,
      text: body,
    });
  }

  // Mark items as QUOTED
  await prisma.gearScheduleItem.updateMany({
    where: { id: { in: items.map(i => i.id) } },
    data:  { quoteStatus: "QUOTED", supplier: supplierName, supplierEmail },
  });

  revalidatePath(`/jobs/${jobId}`);
}
