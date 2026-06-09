export interface ScopeSection {
  id:    string;
  title: string;
  items: string[];   // bullet points
}

export interface AddAlternate {
  id:          string;
  number:      number;
  title:       string;
  desc:        string;
  price:       number;
  bidPackage?: string;  // set when auto-synced from estimator label system
}

export type PaymentTerms =
  'due_on_receipt' | 'net_10' | 'net_15' | 'net_30';

export interface ProposalState {
  // Client info (auto-filled from jobInfo, editable)
  clientCompany:   string;
  clientAttn:      string;

  // Project details
  proposalDate:    string;   // ISO date
  validDays:       number;   // default 30
  workingHours:    string;   // e.g. "Normal Working Hours"

  // Scope
  scopeIntro:      string;   // opening paragraph
  scopeSections:   ScopeSection[];

  // Pricing
  alternates:      AddAlternate[];

  // Inclusions / Exclusions
  inclusions:      string[];
  exclusions:      string[];

  // Terms
  warrantyText:    string;
  paymentTerms:    PaymentTerms;
  paymentNote:     string;   // extra note e.g. scissor lift caveat
  validityNote:    string;   // e.g. "This proposal is valid for 30 days"
  depositEnabled:  boolean;
  depositPercent:  number;   // 1–100
}

export const DEFAULT_INCLUSIONS = [
  'All labor, materials, equipment, and supervision for complete installation',
  'Coordination with all trades',
  'Standard project management and supervision',
  'Installation per NEC and local codes',
];

export const DEFAULT_EXCLUSIONS = [
  'Fire sprinkler system',
  'Equipment rentals unless specifically noted',
  'Utility company work and associated fees',
  'Fire alarm monitoring/service contracts',
  'Data service provider work',
  'Concrete cutting, coring, or structural modifications',
  'Painting and finish repairs by others',
  'Work outside defined project scope unless noted',
];

export const DEFAULT_WARRANTY =
  'Oak Ridge Electrical LLC provides a one (1) year warranty on ' +
  'workmanship from the date of substantial completion. ' +
  'Manufacturer warranties apply to all equipment and materials.';

export const PAYMENT_TERM_LABELS: Record<PaymentTerms, string> = {
  due_on_receipt: 'Due on Receipt',
  net_10:         'Net 10',
  net_15:         'Net 15',
  net_30:         'Net 30',
};

export function getPaymentParagraph(terms: PaymentTerms): string {
  const label   = PAYMENT_TERM_LABELS[terms];
  const daysPast = terms === 'due_on_receipt' ? '5' : terms.replace('net_', '');
  const daysOverdue = terms === 'due_on_receipt' ? 'the due date' : terms.replace('net_', '') + ' days';
  return (
    `Payment terms are ${label} from invoice date. ` +
    `Progress billing will be utilized based on project milestones, ` +
    `materials purchased, or percent complete. Invoices not paid within ` +
    `${daysOverdue} are subject to a finance charge of 1.5% per month ` +
    `(18% annually). Oak Ridge Electrical reserves the right to suspend ` +
    `work on any invoice more than ${daysPast} days past due. Customer ` +
    `agrees to pay all collection costs including attorney's fees, court ` +
    `costs, lien filing fees, and administrative expenses.\n\n` +
    `PAYMENT AGREEMENT — By signing below, Customer acknowledges and ` +
    `agrees to the ${label} payment terms stated herein. Any proposed ` +
    `modification to these payment terms — including adoption of an AIA ` +
    `Schedule of Values or owner/GC billing schedule — must be mutually ` +
    `agreed to in writing prior to contract execution and may result in ` +
    `adjusted pricing to reflect carrying costs. Absent such written ` +
    `agreement, ${label} terms govern this contract.`
  );
}

export function createProposalState(
  jobName?: string,
  _jobNumber?: string,
  gcCompany?: string,
  gcContactName?: string,
): ProposalState {
  return {
    clientCompany:  gcCompany     ?? '',
    clientAttn:     gcContactName ?? '',
    proposalDate:   new Date().toISOString().slice(0, 10),
    validDays:      30,
    workingHours:   'Normal Working Hours',
    scopeIntro:
      'Oak Ridge Electrical LLC shall provide all labor, materials, ' +
      'equipment, and supervision necessary to complete the electrical ' +
      `scope of work for the ${jobName ?? '[Project Name]'} in ` +
      'accordance with applicable codes and project requirements.',
    scopeSections:  [],
    alternates:     [],
    inclusions:     [...DEFAULT_INCLUSIONS],
    exclusions:     [...DEFAULT_EXCLUSIONS],
    warrantyText:   DEFAULT_WARRANTY,
    paymentTerms:   'net_10',
    paymentNote:    '',
    validityNote:   'This proposal is valid for 30 days from the date of issue.',
    depositEnabled: false,
    depositPercent: 30,
  };
}
