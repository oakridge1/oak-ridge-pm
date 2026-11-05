// Plain node tests for lib/autolog/computeAutoLog.ts (needs Node 22.6+ type stripping).
// Run: node scripts/test-autolog.mjs
import assert from 'node:assert/strict';
import {
  computeAutoLog, scheduledHours, easternDateString, yesterdayEastern, laborEntryDay,
} from '../lib/autolog/computeAutoLog.ts';

const D = '2026-11-04';
const job = (over = {}) => ({ id: 'j1', jobNumber: 'J-1', jobName: 'Job One', status: 'IN_PROGRESS', archived: false, ...over });
const user = (id, over = {}) => ({ userId: id, userName: id.toUpperCase(), userActive: true, ...over });
const sch = (over = {}) => ({ id: 's1', date: D, startTime: '07:00', endTime: '15:30', job: job(), assignments: [user('u1')], ...over });
const run = (over = {}) => computeAutoLog({ targetDate: D, schedules: [sch()], clockEntries: [], laborEntries: [], ...over });

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('plain shift: end minus start, no lunch deduction', () => {
  const r = run();
  assert.equal(r.skipped.length, 0);
  assert.equal(r.toLog.length, 1);
  assert.equal(r.toLog[0].hours, 8.5);
  assert.equal(r.toLog[0].reason, 'scheduled');
  assert.equal(r.toLog[0].date, D);
  assert.equal(r.toLog[0].clockEntryId, null);
});

test('missing start or end time = 8 hours', () => {
  assert.equal(run({ schedules: [sch({ startTime: null, endTime: null })] }).toLog[0].hours, 8);
  assert.equal(run({ schedules: [sch({ endTime: null })] }).toLog[0].hours, 8);
  assert.equal(run({ schedules: [sch({ startTime: '' })] }).toLog[0].hours, 8);
  assert.equal(run({ schedules: [sch({ startTime: 'abc' })] }).toLog[0].hours, 8);
});

test('rounds to the nearest quarter hour', () => {
  assert.equal(scheduledHours('07:00', '15:07'), 8);      // 8.117 -> 8.0
  assert.equal(scheduledHours('07:00', '15:08'), 8.25);   // 8.133 -> 8.25
  assert.equal(scheduledHours('07:00', '15:22'), 8.25);   // 8.367 -> 8.25
  assert.equal(scheduledHours('07:00', '15:23'), 8.5);    // 8.383 -> 8.5
  assert.equal(scheduledHours('06:45', '14:50'), 8);      // 8.083 -> 8.0
});

test('only jobs In Progress; other statuses and archived jobs are skipped with a reason', () => {
  for (const status of ['ESTIMATING', 'SUBMITTED', 'BILLED', 'COMPLETED', 'ON_HOLD', 'CANCELLED']) {
    const r = run({ schedules: [sch({ job: job({ status }) })] });
    assert.equal(r.toLog.length, 0);
    assert.equal(r.skipped[0].reason, 'job_not_in_progress');
  }
  const r = run({ schedules: [sch({ job: job({ archived: true }) })] });
  assert.equal(r.skipped[0].reason, 'job_archived');
});

test('inactive users are skipped', () => {
  const r = run({ schedules: [sch({ assignments: [user('u1', { userActive: false }), user('u2')] })] });
  assert.deepEqual(r.toLog.map((i) => i.userId), ['u2']);
  assert.equal(r.skipped[0].reason, 'user_inactive');
});

test('completed clock entry for the shift: skipped', () => {
  const r = run({ clockEntries: [{ id: 'c1', scheduleId: 's1', userId: 'u1', arrivedAt: '2026-11-04T11:00:00Z', departedAt: '2026-11-04T20:00:00Z' }] });
  assert.equal(r.toLog.length, 0);
  assert.equal(r.skipped[0].reason, 'completed_clock_entry');
});

test('Arrive tapped but no Depart: logged as the scheduled shift, flagged forgot_depart', () => {
  const r = run({ clockEntries: [{ id: 'c1', scheduleId: 's1', userId: 'u1', arrivedAt: '2026-11-04T11:05:00Z', departedAt: null }] });
  assert.equal(r.toLog.length, 1);
  assert.equal(r.toLog[0].reason, 'forgot_depart');
  assert.equal(r.toLog[0].hours, 8.5);
  assert.equal(r.toLog[0].clockEntryId, 'c1');
});

test('clock entry with no arrival does not count as clocked in', () => {
  const r = run({ clockEntries: [{ id: 'c1', scheduleId: 's1', userId: 'u1', arrivedAt: null, departedAt: null }] });
  assert.equal(r.toLog[0].reason, 'scheduled');
});

test('any labor entry for the same job, person and day: skipped', () => {
  const r = run({ laborEntries: [{ id: 'l1', jobId: 'j1', userId: 'u1', date: '2026-11-04T00:00:00.000Z' }] });
  assert.equal(r.toLog.length, 0);
  assert.equal(r.skipped[0].reason, 'labor_entry_exists');
});

test('labor entries for another job, person or day do not block', () => {
  const r = run({ laborEntries: [
    { id: 'l1', jobId: 'j2', userId: 'u1', date: '2026-11-04T00:00:00.000Z' },
    { id: 'l2', jobId: 'j1', userId: 'u2', date: '2026-11-04T00:00:00.000Z' },
    { id: 'l3', jobId: 'j1', userId: 'u1', date: '2026-11-03T00:00:00.000Z' },
  ] });
  assert.equal(r.toLog.length, 1);
});

test('a labor entry already linked to this shift: skipped as already_auto_logged', () => {
  const r = run({ laborEntries: [{ id: 'l1', jobId: 'j1', userId: 'u1', date: '2026-11-04T00:00:00.000Z', scheduleId: 's1' }] });
  assert.equal(r.skipped[0].reason, 'already_auto_logged');
});

test('same person on two shifts for the same job and day: only the first is planned', () => {
  const r = run({ schedules: [sch({ id: 's1' }), sch({ id: 's2' })] });
  assert.equal(r.toLog.length, 1);
  assert.equal(r.toLog[0].scheduleId, 's1');
  assert.equal(r.skipped[0].reason, 'duplicate_shift_same_day');
});

test('end before start (or equal) is skipped, never negative hours', () => {
  assert.equal(run({ schedules: [sch({ startTime: '15:00', endTime: '07:00' })] }).skipped[0].reason, 'zero_or_negative_hours');
  assert.equal(run({ schedules: [sch({ startTime: '07:00', endTime: '07:00' })] }).skipped[0].reason, 'zero_or_negative_hours');
});

test('only shifts on the target date are processed', () => {
  const r = run({ schedules: [sch({ date: '2026-11-03' }), sch({ id: 's2', date: '2026-11-05' })] });
  assert.equal(r.toLog.length, 0);
  assert.equal(r.skipped.length, 0);
});

test('re-running with the planned entries now present logs nothing new (idempotent)', () => {
  const first = run();
  const labor = first.toLog.map((i, k) => ({ id: `l${k}`, jobId: i.jobId, userId: i.userId, date: '2026-11-04T00:00:00.000Z', scheduleId: i.scheduleId }));
  const second = run({ laborEntries: labor });
  assert.equal(second.toLog.length, 0);
});

test('is pure: inputs are not mutated and results are stable', () => {
  const input = { targetDate: D, schedules: [sch({ assignments: [user('u2'), user('u1')] })], clockEntries: [], laborEntries: [] };
  const snapshot = JSON.stringify(input);
  const a = computeAutoLog(input);
  const b = computeAutoLog(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(a, b);
  assert.deepEqual(a.toLog.map((i) => i.userId), ['u1', 'u2']);
});

// ── Eastern-time edges ──
test('"yesterday" is computed in Eastern time, not UTC', () => {
  // Nov 5 2026 21:30 EST is already Nov 6 in UTC. Eastern yesterday is Nov 4; UTC yesterday would say Nov 5.
  assert.equal(easternDateString(new Date('2026-11-06T02:30:00Z')), '2026-11-05');
  assert.equal(yesterdayEastern(new Date('2026-11-06T02:30:00Z')), '2026-11-04');
  // The real 06:00 UTC run is 01:00 EST on Nov 6: yesterday is Nov 5.
  assert.equal(yesterdayEastern(new Date('2026-11-06T06:00:00Z')), '2026-11-05');
});

test('Eastern day around the DST change (Nov 1 2026, clocks fall back)', () => {
  assert.equal(yesterdayEastern(new Date('2026-11-02T06:00:00Z')), '2026-11-01');
  assert.equal(yesterdayEastern(new Date('2026-10-31T05:00:00Z')), '2026-10-30'); // 01:00 EDT Oct 31
  assert.equal(easternDateString(new Date('2026-11-01T05:30:00Z')), '2026-11-01'); // 01:30 EDT, before the change
});

test('labor entry stored late evening Eastern counts toward the Eastern day, not the UTC day', () => {
  // 2026-11-05T02:00Z = Nov 4, 9:00 pm EST. It is a Nov 4 entry, so it blocks the Nov 4 shift...
  assert.equal(laborEntryDay('2026-11-05T02:00:00Z'), '2026-11-04');
  const blocks = run({ laborEntries: [{ id: 'l1', jobId: 'j1', userId: 'u1', date: '2026-11-05T02:00:00Z' }] });
  assert.equal(blocks.skipped[0].reason, 'labor_entry_exists');
  // ...and does NOT block a Nov 5 shift even though the UTC date is Nov 5.
  const free = computeAutoLog({
    targetDate: '2026-11-05',
    schedules: [sch({ date: '2026-11-05' })],
    clockEntries: [],
    laborEntries: [{ id: 'l1', jobId: 'j1', userId: 'u1', date: '2026-11-05T02:00:00Z' }],
  });
  assert.equal(free.toLog.length, 1);
});

test('date-only labor entries (midnight UTC) keep their own day; noon clock-out stamps convert normally', () => {
  assert.equal(laborEntryDay('2026-11-04T00:00:00.000Z'), '2026-11-04');
  assert.equal(laborEntryDay(new Date('2026-11-04T12:00:00Z')), '2026-11-04');
  assert.equal(laborEntryDay('not a date'), '');
});

// ── step 4: write guards (pure helpers) ──
import {
  parseJobNumberAllowlist, isJobAllowed, isDateAllowed, autoLogBlockReason, isUniqueViolation,
} from '../lib/autolog/autologGuards.ts';

test('allowlist parsing: trims, drops blanks and duplicates; unset means empty', () => {
  assert.deepEqual(parseJobNumberAllowlist('training123'), ['training123']);
  assert.deepEqual(parseJobNumberAllowlist(' a, b ,, c ,a'), ['a', 'b', 'c']);
  assert.deepEqual(parseJobNumberAllowlist(''), []);
  assert.deepEqual(parseJobNumberAllowlist('  ,  '), []);
  assert.deepEqual(parseJobNumberAllowlist(undefined), []);
  assert.deepEqual(parseJobNumberAllowlist(null), []);
});

test('isJobAllowed: trimmed, case-insensitive, whole-number match; empty list allows nothing', () => {
  const list = ['training123', 'J-9'];
  assert.equal(isJobAllowed('training123', list), true);
  assert.equal(isJobAllowed(' J-9 ', list), true);
  assert.equal(isJobAllowed('TRAINING123', list), true);
  assert.equal(isJobAllowed('  Training123  ', list), true);
  assert.equal(isJobAllowed('j-9', list), true);
  assert.equal(isJobAllowed('training1234', list), false);
  assert.equal(isJobAllowed('training12', list), false);
  assert.equal(isJobAllowed('training123', []), false);
  assert.equal(isJobAllowed('', ['']), false);
  assert.equal(isJobAllowed('   ', list), false);
});

test('allowlist from env text is case-insensitive end to end', () => {
  const list = parseJobNumberAllowlist(' Training123 , J-9 ');
  assert.equal(isJobAllowed('TRAINING123', list), true);
  assert.equal(isJobAllowed('training123', list), true);
  assert.equal(isJobAllowed('j-10', list), false);
});

test('start date: on or after is allowed; before is not; unset is no limit', () => {
  assert.equal(isDateAllowed('2026-11-05', '2026-11-05'), true);
  assert.equal(isDateAllowed('2026-11-06', '2026-11-05'), true);
  assert.equal(isDateAllowed('2026-11-04', '2026-11-05'), false);
  assert.equal(isDateAllowed('2026-11-04', undefined), true);
  assert.equal(isDateAllowed('2026-11-04', ''), true);
  assert.equal(isDateAllowed('2027-01-01', '2026-12-31'), true);
});

test('start date set but unreadable fails closed', () => {
  assert.equal(isDateAllowed('2026-11-05', 'next tuesday'), false);
  assert.equal(isDateAllowed('bad', '2026-11-05'), false);
});

test('autoLogBlockReason: unset list = disabled, early date = blocked, otherwise null', () => {
  assert.equal(autoLogBlockReason('2026-11-05', {}), 'disabled');
  assert.equal(autoLogBlockReason('2026-11-05', { jobNumbers: '', startDate: '2026-01-01' }), 'disabled');
  assert.equal(autoLogBlockReason('2026-11-01', { jobNumbers: 'training123', startDate: '2026-11-05' }), 'before_start_date');
  assert.equal(autoLogBlockReason('2026-11-05', { jobNumbers: 'training123', startDate: '2026-11-05' }), null);
  assert.equal(autoLogBlockReason('2026-11-05', { jobNumbers: 'training123' }), null);
});

test('isUniqueViolation recognizes Prisma and Postgres unique errors only', () => {
  assert.equal(isUniqueViolation({ code: 'P2002' }), true);
  assert.equal(isUniqueViolation({ code: '23505' }), true);
  assert.equal(isUniqueViolation(new Error('Unique constraint failed on the fields: (`scheduleId`,`userId`)')), true);
  assert.equal(isUniqueViolation({ code: 'P2025' }), false);
  assert.equal(isUniqueViolation(new Error('connection reset')), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation('x'), false);
});

// ── step 5: cron secret check, "yesterday" at run time, summary email text ──
import { checkCronAuth, shouldSendSummary, buildSummaryText, summarySubject } from '../lib/autolog/cronHelpers.ts';

test('cron secret missing or empty: 500, nothing runs (even with a header that looks right)', () => {
  for (const secret of [undefined, null, '']) {
    const r = checkCronAuth(secret, 'Bearer undefined');
    assert.equal(r.ok, false);
    assert.equal(r.status, 500);
  }
  assert.equal(checkCronAuth(undefined, null).status, 500);
  assert.equal(checkCronAuth('', 'Bearer ').status, 500);
});

test('cron secret set but header wrong or missing: 401', () => {
  for (const header of [null, undefined, '', 'Bearer', 'Bearer wrong', 'bearer s3cret', 'Bearer s3cret ', ' Bearer s3cret', 's3cret', 'Basic s3cret']) {
    const r = checkCronAuth('s3cret', header);
    assert.equal(r.ok, false, `header ${JSON.stringify(header)}`);
    assert.equal(r.status, 401);
  }
});

test('cron secret set and header exactly right: ok', () => {
  assert.deepEqual(checkCronAuth('s3cret', 'Bearer s3cret'), { ok: true });
});

test('cron run at 06:00 UTC processes yesterday in Eastern time (winter and summer)', () => {
  assert.equal(yesterdayEastern(new Date('2026-11-06T06:00:00Z')), '2026-11-05'); // 01:00 EST
  assert.equal(yesterdayEastern(new Date('2026-07-15T06:00:00Z')), '2026-07-14'); // 02:00 EDT
});

test('a run just after midnight UTC still counts the Eastern evening as "today"', () => {
  // 00:05 UTC Nov 6 = 7:05 pm EST Nov 5, so yesterday is Nov 4 (UTC date math would give Nov 5).
  assert.equal(yesterdayEastern(new Date('2026-11-06T00:05:00Z')), '2026-11-04');
  // 00:05 UTC in July = 8:05 pm EDT the day before.
  assert.equal(yesterdayEastern(new Date('2026-07-15T00:05:00Z')), '2026-07-13');
  // Just after midnight Eastern (04:05 UTC in July) rolls over to a new Eastern day.
  assert.equal(yesterdayEastern(new Date('2026-07-15T04:05:00Z')), '2026-07-14');
});

const item = (over = {}) => ({ scheduleId: 's1', jobId: 'j1', jobNumber: 'training123', jobName: 'Training', userId: 'u1', userName: 'Steven', date: D, hours: 8.5, reason: 'scheduled', clockEntryId: null, ...over });
const sum = (over = {}) => ({ targetDate: D, logged: [], skipped: [], errors: [], ...over });

test('summary email only when something was logged or errored', () => {
  assert.equal(shouldSendSummary(sum()), false);
  assert.equal(shouldSendSummary(sum({ skipped: [{ scheduleId: 's', userId: 'u', userName: 'x', jobNumber: 'j', reason: 'user_inactive' }] })), false);
  assert.equal(shouldSendSummary(sum({ logged: [item()] })), true);
  assert.equal(shouldSendSummary(sum({ errors: [{ scheduleId: 's', userId: 'u', userName: 'x', jobNumber: 'j', message: 'boom' }] })), true);
});

test('summary text: date, one line per entry, reasons, no dollar amounts', () => {
  const text = buildSummaryText(sum({
    logged: [item(), item({ userId: 'u2', userName: 'Tyler', hours: 8, reason: 'forgot_depart' })],
    skipped: [
      { scheduleId: 's1', userId: 'u3', userName: 'Caleb', jobNumber: 'TRAINING123', reason: 'labor_entry_exists' },
      { scheduleId: 's9', userId: 'u4', userName: 'Other', jobNumber: 'J-99', reason: 'job_not_in_progress' },
    ],
    errors: [{ scheduleId: 's1', userId: 'u5', userName: 'Michael', jobNumber: 'training123', message: 'db down' }],
  }), (jobNumber) => isJobAllowed(jobNumber, ['training123']));
  assert.ok(text.includes(D));
  assert.ok(text.includes('training123 Training - Steven - 8.5 hrs'));
  assert.ok(text.includes('Tyler - 8 hrs (arrived, never departed'));
  assert.ok(text.includes('Caleb - already has hours on this job that day'));
  assert.ok(!text.includes('Other'), 'skips for jobs that are not enabled are left out');
  assert.ok(text.includes('Michael - db down'));
  assert.ok(!text.includes('$'));
  assert.equal(summarySubject(sum({ logged: [item()], errors: [1] })), `Auto-log ${D}: 1 logged, 1 error`);
  assert.equal(summarySubject(sum({ logged: [item(), item()] })), `Auto-log ${D}: 2 logged`);
});

console.log(`\n${n} tests passed`);
