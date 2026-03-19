import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

/**
 * Demo seed data for PRM Portal.
 * Populates realistic, time-distributed data across 6 months for a 5-minute demo.
 *
 * IMPORTANT: This seed must run AFTER 001_seed_data.ts.
 * It reads existing IDs from the database rather than re-generating them,
 * so it works regardless of whether UUIDs were hardcoded or random.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Return a date N days ago from today */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Random integer in [min, max] */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Spread a date randomly within a range of days-ago */
function randomDate(minDaysAgo: number, maxDaysAgo: number): Date {
  return daysAgo(randInt(minDaysAgo, maxDaysAgo));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────────────────────────
// Seed
// ──────────────────────────────────────────────────────────────────────────────

export async function seed(knex: Knex): Promise<void> {
  // ─── Clean demo-only tables (preserves tier, product, user, org data) ──────
  await knex('activity_feed').del();
  await knex('notifications').del();
  await knex('user_certifications').del();
  await knex('mdf_requests').del();
  await knex('mdf_allocations').del();
  await knex('quote_line_items').del();
  await knex('quote_status_history').del();
  await knex('quotes').del();
  await knex('deal_products').del();
  await knex('deal_status_history').del();
  await knex('leads').del();
  await knex('deals').del();

  // ─── Fetch reference data ──────────────────────────────────────────────────

  const orgs = await knex('organizations').select('id', 'name', 'tier_id');
  const users = await knex('users').select('id', 'email', 'role', 'organization_id');
  const products = await knex('products').select('id', 'sku', 'name', 'list_price', 'cost', 'category_id');
  const tiers = await knex('partner_tiers').select('id', 'name', 'rank');
  const courses = await knex('courses').select('id', 'name');

  // Build lookup helpers
  const orgByName = (name: string) => orgs.find((o: any) => o.name.includes(name))!;
  const userByEmail = (email: string) => users.find((u: any) => u.email === email)!;
  const productBySku = (sku: string) => products.find((p: any) => p.sku === sku)!;
  const tierByName = (name: string) => tiers.find((t: any) => t.name === name)!;

  const cybershield = orgByName('CyberShield');
  const cloudguard = orgByName('CloudGuard');
  const netsecure = orgByName('NetSecure');
  const techdefend = orgByName('TechDefend');

  const admin = userByEmail('admin@prmportal.com');
  const cm1 = userByEmail('sarah.chen@prmportal.com');
  const cm2 = userByEmail('marcus.johnson@prmportal.com');
  const csAdmin = userByEmail('admin@cybershield.com');
  const csRep = userByEmail('rep@cybershield.com');
  const cgAdmin = userByEmail('admin@cloudguard.io');
  const cgRep = userByEmail('rep@cloudguard.io');
  const nsAdmin = userByEmail('admin@netsecure.net');
  const nsRep = userByEmail('rep@netsecure.net');
  const tdAdmin = userByEmail('admin@techdefend.com');
  const tdRep = userByEmail('rep@techdefend.com');

  // Partner users mapped by org for easy iteration
  const orgUsers: Record<string, { admin: any; rep: any; cm: any }> = {
    [cybershield.id]: { admin: csAdmin, rep: csRep, cm: cm1 },
    [cloudguard.id]:  { admin: cgAdmin, rep: cgRep, cm: cm1 },
    [netsecure.id]:   { admin: nsAdmin, rep: nsRep, cm: cm2 },
    [techdefend.id]:  { admin: tdAdmin, rep: tdRep, cm: cm2 },
  };

  // Demo customer data
  const customers = [
    { company: 'Acme Financial Corp', contact: 'John Smith', email: 'jsmith@acmefinancial.com', industry: 'Financial Services' },
    { company: 'GlobalBank Holdings', contact: 'Maria Garcia', email: 'mgarcia@globalbank.com', industry: 'Banking' },
    { company: 'MedTech Innovations', contact: 'Dr. Sarah Lee', email: 'slee@medtech.io', industry: 'Healthcare' },
    { company: 'RetailMax Inc', contact: 'Tom Baker', email: 'tbaker@retailmax.com', industry: 'Retail' },
    { company: 'CloudNine Enterprises', contact: 'Alex Chen', email: 'achen@cloudnine.com', industry: 'Technology' },
    { company: 'GovSecure Agency', contact: 'Patricia Williams', email: 'pwilliams@govsecure.gov', industry: 'Government' },
    { company: 'AutoDrive Motors', contact: 'James Rodriguez', email: 'jrodriguez@autodrive.com', industry: 'Manufacturing' },
    { company: 'EduTech Solutions', contact: 'Linda Kim', email: 'lkim@edutech.edu', industry: 'Education' },
    { company: 'PharmaCore Labs', contact: 'Dr. Robert Patel', email: 'rpatel@pharmacore.com', industry: 'Pharmaceuticals' },
    { company: 'AeroDefense Systems', contact: 'Col. Mike Taylor', email: 'mtaylor@aerodefense.com', industry: 'Aerospace' },
    { company: 'InsureTech Global', contact: 'Sandra Brown', email: 'sbrown@insuretech.com', industry: 'Insurance' },
    { company: 'DataStream Analytics', contact: 'Kevin Nguyen', email: 'knguyen@datastream.io', industry: 'Technology' },
    { company: 'Pacific Energy Corp', contact: 'Rachel Green', email: 'rgreen@pacificenergy.com', industry: 'Energy' },
    { company: 'NorthStar Logistics', contact: 'David Walsh', email: 'dwalsh@northstar.com', industry: 'Logistics' },
    { company: 'BioGenesis Research', contact: 'Dr. Amy Liu', email: 'aliu@biogenesis.com', industry: 'Biotech' },
  ];

  // Product groupings for realistic deals
  const productBundles = [
    { skus: ['PA-5400-BASE', 'PS-DEPLOYMENT'], label: 'Enterprise Firewall' },
    { skus: ['PA-3400-BASE', 'PS-DEPLOYMENT'], label: 'Campus Firewall' },
    { skus: ['PA-1400-BASE', 'PA-400-BASE'], label: 'Branch Firewall Bundle' },
    { skus: ['PRISMA-ACCESS', 'PRISMA-SDWAN'], label: 'SASE Deployment' },
    { skus: ['PRISMA-SASE-BUNDLE'], label: 'Prisma SASE Complete' },
    { skus: ['PRISMA-CLOUD-ENT', 'CORTEX-XDR-PRO'], label: 'Cloud + XDR' },
    { skus: ['PRISMA-CLOUD-STD'], label: 'Cloud Security Standard' },
    { skus: ['CORTEX-XSIAM', 'CORTEX-XSOAR'], label: 'Security Operations Suite' },
    { skus: ['CORTEX-XDR-PRO', 'PS-DEPLOYMENT'], label: 'XDR Pro Deployment' },
    { skus: ['CORTEX-XDR-STD'], label: 'XDR Standard' },
    { skus: ['VM-SERIES-300', 'CN-SERIES'], label: 'Virtual + Container Security' },
    { skus: ['CLOUD-NGFW', 'PRISMA-CLOUD-STD'], label: 'Cloud Network Security' },
    { skus: ['UNIT42-IR'], label: 'Incident Response Retainer' },
    { skus: ['UNIT42-RA', 'PA-3400-BASE'], label: 'Risk Assessment + Firewall' },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // DEALS (35 total)
  // ═══════════════════════════════════════════════════════════════════════════

  type DealSpec = {
    org: any;
    customer: typeof customers[0];
    bundle: typeof productBundles[0];
    status: string;
    value: number;
    daysAgoCreated: number;
    winProb: number;
    hasConflict?: boolean;
  };

  const dealSpecs: DealSpec[] = [
    // ── CyberShield (Diamond) — 12 deals ──
    { org: cybershield, customer: customers[0],  bundle: productBundles[7],  status: 'won',          value: 1850000, daysAgoCreated: 150, winProb: 100 },
    { org: cybershield, customer: customers[1],  bundle: productBundles[0],  status: 'won',          value: 520000,  daysAgoCreated: 130, winProb: 100 },
    { org: cybershield, customer: customers[9],  bundle: productBundles[5],  status: 'won',          value: 780000,  daysAgoCreated: 100, winProb: 100 },
    { org: cybershield, customer: customers[2],  bundle: productBundles[4],  status: 'won',          value: 350000,  daysAgoCreated: 75,  winProb: 100 },
    { org: cybershield, customer: customers[14], bundle: productBundles[12], status: 'approved',      value: 200000,  daysAgoCreated: 30,  winProb: 80 },
    { org: cybershield, customer: customers[3],  bundle: productBundles[8],  status: 'approved',      value: 165000,  daysAgoCreated: 25,  winProb: 75 },
    { org: cybershield, customer: customers[12], bundle: productBundles[3],  status: 'under_review',  value: 420000,  daysAgoCreated: 10,  winProb: 60 },
    { org: cybershield, customer: customers[4],  bundle: productBundles[11], status: 'submitted',     value: 280000,  daysAgoCreated: 5,   winProb: 50 },
    { org: cybershield, customer: customers[5],  bundle: productBundles[0],  status: 'lost',          value: 600000,  daysAgoCreated: 120, winProb: 0 },
    { org: cybershield, customer: customers[6],  bundle: productBundles[10], status: 'expired',       value: 95000,   daysAgoCreated: 160, winProb: 0 },
    { org: cybershield, customer: customers[7],  bundle: productBundles[9],  status: 'draft',         value: 56000,   daysAgoCreated: 2,   winProb: 30 },
    { org: cybershield, customer: customers[13], bundle: productBundles[1],  status: 'rejected',      value: 180000,  daysAgoCreated: 45,  winProb: 0, hasConflict: true },

    // ── CloudGuard (Platinum) — 10 deals ──
    { org: cloudguard, customer: customers[4],  bundle: productBundles[5],  status: 'won',           value: 680000,  daysAgoCreated: 140, winProb: 100 },
    { org: cloudguard, customer: customers[8],  bundle: productBundles[4],  status: 'won',           value: 450000,  daysAgoCreated: 110, winProb: 100 },
    { org: cloudguard, customer: customers[10], bundle: productBundles[6],  status: 'won',           value: 120000,  daysAgoCreated: 85,  winProb: 100 },
    { org: cloudguard, customer: customers[11], bundle: productBundles[3],  status: 'approved',      value: 310000,  daysAgoCreated: 20,  winProb: 70 },
    { org: cloudguard, customer: customers[12], bundle: productBundles[8],  status: 'submitted',     value: 185000,  daysAgoCreated: 8,   winProb: 55, hasConflict: true },
    { org: cloudguard, customer: customers[0],  bundle: productBundles[13], status: 'under_review',  value: 240000,  daysAgoCreated: 12,  winProb: 60 },
    { org: cloudguard, customer: customers[3],  bundle: productBundles[2],  status: 'lost',          value: 75000,   daysAgoCreated: 90,  winProb: 0 },
    { org: cloudguard, customer: customers[6],  bundle: productBundles[9],  status: 'lost',          value: 98000,   daysAgoCreated: 105, winProb: 0 },
    { org: cloudguard, customer: customers[7],  bundle: productBundles[10], status: 'expired',       value: 145000,  daysAgoCreated: 170, winProb: 0 },
    { org: cloudguard, customer: customers[14], bundle: productBundles[11], status: 'draft',         value: 190000,  daysAgoCreated: 3,   winProb: 40 },

    // ── NetSecure (Innovator) — 8 deals ──
    { org: netsecure, customer: customers[5],  bundle: productBundles[1],  status: 'won',           value: 85000,   daysAgoCreated: 125, winProb: 100 },
    { org: netsecure, customer: customers[13], bundle: productBundles[9],  status: 'approved',      value: 68000,   daysAgoCreated: 35,  winProb: 65 },
    { org: netsecure, customer: customers[1],  bundle: productBundles[6],  status: 'submitted',     value: 92000,   daysAgoCreated: 7,   winProb: 50 },
    { org: netsecure, customer: customers[8],  bundle: productBundles[2],  status: 'under_review',  value: 54000,   daysAgoCreated: 14,  winProb: 45 },
    { org: netsecure, customer: customers[10], bundle: productBundles[9],  status: 'lost',          value: 72000,   daysAgoCreated: 95,  winProb: 0 },
    { org: netsecure, customer: customers[11], bundle: productBundles[2],  status: 'expired',       value: 48000,   daysAgoCreated: 155, winProb: 0 },
    { org: netsecure, customer: customers[3],  bundle: productBundles[8],  status: 'rejected',      value: 110000,  daysAgoCreated: 50,  winProb: 0 },
    { org: netsecure, customer: customers[14], bundle: productBundles[1],  status: 'submitted',     value: 62000,   daysAgoCreated: 4,   winProb: 45 },

    // ── TechDefend (Registered) — 5 deals ──
    { org: techdefend, customer: customers[7],  bundle: productBundles[2],  status: 'approved',      value: 52000,  daysAgoCreated: 40,  winProb: 55 },
    { org: techdefend, customer: customers[12], bundle: productBundles[9],  status: 'submitted',     value: 38000,  daysAgoCreated: 6,   winProb: 40 },
    { org: techdefend, customer: customers[6],  bundle: productBundles[2],  status: 'draft',         value: 65000,  daysAgoCreated: 1,   winProb: 25 },
    { org: techdefend, customer: customers[9],  bundle: productBundles[2],  status: 'lost',          value: 42000,  daysAgoCreated: 80,  winProb: 0 },
    { org: techdefend, customer: customers[11], bundle: productBundles[9],  status: 'expired',       value: 29000,  daysAgoCreated: 165, winProb: 0 },
  ];

  const dealIds: string[] = [];
  const wonDealIds: string[] = [];
  let dealSeq = 1;

  for (const spec of dealSpecs) {
    const dealId = uuidv4();
    dealIds.push(dealId);
    if (spec.status === 'won') wonDealIds.push(dealId);

    const orgU = orgUsers[spec.org.id];
    const submitter = pick([orgU.admin, orgU.rep]);
    const created = daysAgo(spec.daysAgoCreated);
    const dealNumber = `DR-2026-${String(dealSeq++).padStart(5, '0')}`;

    const closeDate = spec.status === 'won' || spec.status === 'lost'
      ? daysAgo(spec.daysAgoCreated - randInt(20, 60))
      : daysAgo(-randInt(10, 90)); // future

    const isApproved = ['approved', 'won', 'lost', 'expired'].includes(spec.status);
    const approvedDate = isApproved ? daysAgo(spec.daysAgoCreated - randInt(3, 15)) : null;
    const expiresDate = isApproved ? daysAgo(spec.daysAgoCreated - 90) : null;
    const actualCloseDate = (spec.status === 'won' || spec.status === 'lost') ? closeDate : null;

    const primaryProduct = productBySku(spec.bundle.skus[0]);

    await knex('deals').insert({
      id: dealId,
      deal_number: dealNumber,
      organization_id: spec.org.id,
      submitted_by: submitter.id,
      assigned_to: orgU.cm.id,
      customer_company_name: spec.customer.company,
      customer_contact_name: spec.customer.contact,
      customer_contact_email: spec.customer.email,
      customer_industry: spec.customer.industry,
      deal_name: `${spec.customer.company} - ${spec.bundle.label}`,
      description: `${spec.bundle.label} deployment for ${spec.customer.company}`,
      status: spec.status,
      estimated_value: spec.value,
      actual_value: spec.status === 'won' ? Math.round(spec.value * (0.85 + Math.random() * 0.2)) : null,
      win_probability: spec.winProb,
      expected_close_date: isoDate(closeDate),
      actual_close_date: actualCloseDate ? isoDate(actualCloseDate) : null,
      registration_expires_at: expiresDate ? expiresDate.toISOString() : null,
      primary_product_id: primaryProduct.id,
      is_conflicting: spec.hasConflict || false,
      conflict_notes: spec.hasConflict ? 'Potential overlap with existing deal in same territory' : null,
      approved_by: isApproved ? orgU.cm.id : null,
      approved_at: approvedDate ? approvedDate.toISOString() : null,
      rejection_reason: spec.status === 'rejected' ? 'Insufficient deal justification or territory conflict' : null,
      source: pick(['direct', 'referral', 'marketing', 'event', 'website']),
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });

    // ── Deal products ──
    for (const sku of spec.bundle.skus) {
      const prod = productBySku(sku);
      const qty = prod.sku.startsWith('PA-400') ? randInt(2, 8) : randInt(1, 3);
      const discountPct = randInt(5, 25);
      await knex('deal_products').insert({
        id: uuidv4(),
        deal_id: dealId,
        product_id: prod.id,
        quantity: qty,
        unit_price: prod.list_price,
        discount_pct: discountPct,
      });
    }

    // ── Deal status history ──
    const transitions: { from: string | null; to: string; dAgo: number }[] = [];
    const ca = spec.daysAgoCreated;
    transitions.push({ from: null, to: 'draft', dAgo: ca });

    if (spec.status !== 'draft') {
      transitions.push({ from: 'draft', to: 'submitted', dAgo: ca - 1 });
    }
    if (['under_review', 'approved', 'rejected', 'won', 'lost', 'expired'].includes(spec.status)) {
      transitions.push({ from: 'submitted', to: spec.status === 'rejected' ? 'rejected' : 'under_review', dAgo: ca - 3 });
    }
    if (['approved', 'won', 'lost', 'expired'].includes(spec.status)) {
      transitions.push({ from: 'under_review', to: 'approved', dAgo: ca - 7 });
    }
    if (spec.status === 'won') {
      transitions.push({ from: 'approved', to: 'won', dAgo: ca - randInt(25, 55) });
    }
    if (spec.status === 'lost') {
      transitions.push({ from: 'approved', to: 'lost', dAgo: ca - randInt(20, 50) });
    }
    if (spec.status === 'expired') {
      transitions.push({ from: 'approved', to: 'expired', dAgo: ca - 90 });
    }
    if (spec.status === 'rejected') {
      transitions.push({ from: 'under_review', to: 'rejected', dAgo: ca - 5 });
    }

    for (const t of transitions) {
      await knex('deal_status_history').insert({
        id: uuidv4(),
        deal_id: dealId,
        from_status: t.from,
        to_status: t.to,
        changed_by: t.to === 'draft' || t.to === 'submitted' ? submitter.id : orgU.cm.id,
        notes: t.to === 'rejected' ? 'Territory conflict — needs resolution' : null,
        created_at: daysAgo(Math.max(t.dAgo, 0)).toISOString(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTES (18 total)
  // ═══════════════════════════════════════════════════════════════════════════

  type QuoteSpec = {
    org: any;
    customerName: string;
    customerEmail: string;
    status: string;
    dealIndex: number | null; // index into dealIds
    daysAgoCreated: number;
    itemSkus: string[];
  };

  const quoteSpecs: QuoteSpec[] = [
    // CyberShield quotes
    { org: cybershield, customerName: 'Acme Financial Corp',   customerEmail: 'jsmith@acmefinancial.com', status: 'approved',          dealIndex: 0,    daysAgoCreated: 145, itemSkus: ['CORTEX-XSIAM', 'CORTEX-XSOAR'] },
    { org: cybershield, customerName: 'GlobalBank Holdings',   customerEmail: 'mgarcia@globalbank.com',   status: 'approved',          dealIndex: 1,    daysAgoCreated: 125, itemSkus: ['PA-5400-BASE', 'PS-DEPLOYMENT'] },
    { org: cybershield, customerName: 'AeroDefense Systems',   customerEmail: 'mtaylor@aerodefense.com',  status: 'sent_to_customer',  dealIndex: 2,    daysAgoCreated: 95,  itemSkus: ['PRISMA-CLOUD-ENT', 'CORTEX-XDR-PRO'] },
    { org: cybershield, customerName: 'BioGenesis Research',   customerEmail: 'aliu@biogenesis.com',      status: 'pending_approval',  dealIndex: 4,    daysAgoCreated: 28,  itemSkus: ['UNIT42-IR'] },
    { org: cybershield, customerName: 'Pacific Energy Corp',   customerEmail: 'rgreen@pacificenergy.com', status: 'draft',             dealIndex: null, daysAgoCreated: 8,   itemSkus: ['PRISMA-ACCESS', 'PRISMA-SDWAN'] },

    // CloudGuard quotes
    { org: cloudguard, customerName: 'CloudNine Enterprises',  customerEmail: 'achen@cloudnine.com',      status: 'approved',          dealIndex: 12,   daysAgoCreated: 135, itemSkus: ['PRISMA-CLOUD-ENT', 'CORTEX-XDR-PRO'] },
    { org: cloudguard, customerName: 'PharmaCore Labs',        customerEmail: 'rpatel@pharmacore.com',    status: 'approved',          dealIndex: 13,   daysAgoCreated: 105, itemSkus: ['PRISMA-SASE-BUNDLE'] },
    { org: cloudguard, customerName: 'InsureTech Global',      customerEmail: 'sbrown@insuretech.com',    status: 'sent_to_customer',  dealIndex: 14,   daysAgoCreated: 80,  itemSkus: ['PRISMA-CLOUD-STD'] },
    { org: cloudguard, customerName: 'DataStream Analytics',   customerEmail: 'knguyen@datastream.io',    status: 'draft',             dealIndex: null, daysAgoCreated: 5,   itemSkus: ['CORTEX-XDR-STD'] },
    { org: cloudguard, customerName: 'Acme Financial Corp',    customerEmail: 'jsmith@acmefinancial.com', status: 'pending_approval',  dealIndex: 17,   daysAgoCreated: 10,  itemSkus: ['UNIT42-RA', 'PA-3400-BASE'] },

    // NetSecure quotes
    { org: netsecure, customerName: 'GovSecure Agency',        customerEmail: 'pwilliams@govsecure.gov',  status: 'approved',          dealIndex: 22,   daysAgoCreated: 120, itemSkus: ['PA-3400-BASE', 'PS-DEPLOYMENT'] },
    { org: netsecure, customerName: 'NorthStar Logistics',     customerEmail: 'dwalsh@northstar.com',     status: 'sent_to_customer',  dealIndex: 23,   daysAgoCreated: 30,  itemSkus: ['CORTEX-XDR-STD'] },
    { org: netsecure, customerName: 'GlobalBank Holdings',     customerEmail: 'mgarcia@globalbank.com',   status: 'draft',             dealIndex: null, daysAgoCreated: 6,   itemSkus: ['PRISMA-CLOUD-STD'] },
    { org: netsecure, customerName: 'RetailMax Inc',           customerEmail: 'tbaker@retailmax.com',     status: 'rejected',          dealIndex: null, daysAgoCreated: 45,  itemSkus: ['CORTEX-XDR-PRO', 'PS-DEPLOYMENT'] },

    // TechDefend quotes
    { org: techdefend, customerName: 'EduTech Solutions',      customerEmail: 'lkim@edutech.edu',         status: 'draft',             dealIndex: 30,   daysAgoCreated: 38,  itemSkus: ['PA-1400-BASE', 'PA-400-BASE'] },
    { org: techdefend, customerName: 'Pacific Energy Corp',    customerEmail: 'rgreen@pacificenergy.com', status: 'draft',             dealIndex: null, daysAgoCreated: 4,   itemSkus: ['PA-400-BASE'] },
    { org: techdefend, customerName: 'AutoDrive Motors',       customerEmail: 'jrodriguez@autodrive.com', status: 'approved',          dealIndex: null, daysAgoCreated: 70,  itemSkus: ['PA-1400-BASE'] },
    { org: techdefend, customerName: 'DataStream Analytics',   customerEmail: 'knguyen@datastream.io',    status: 'pending_approval',  dealIndex: null, daysAgoCreated: 15,  itemSkus: ['CORTEX-XDR-STD'] },
  ];

  let quoteSeq = 1;

  for (const spec of quoteSpecs) {
    const quoteId = uuidv4();
    const orgU = orgUsers[spec.org.id];
    const creator = pick([orgU.admin, orgU.rep]);
    const created = daysAgo(spec.daysAgoCreated);
    const quoteNumber = `QT-2026-${String(quoteSeq++).padStart(5, '0')}`;

    // Calculate totals from line items
    let subtotal = 0;
    let totalDiscount = 0;
    const lineItems: any[] = [];

    for (let i = 0; i < spec.itemSkus.length; i++) {
      const prod = productBySku(spec.itemSkus[i]);
      const qty = prod.sku.startsWith('PA-400') ? randInt(2, 5) : randInt(1, 2);
      const discountPct = randInt(5, 20);
      const discountAmount = prod.list_price * (discountPct / 100);
      const unitPrice = prod.list_price - discountAmount;

      subtotal += prod.list_price * qty;
      totalDiscount += discountAmount * qty;

      lineItems.push({
        id: uuidv4(),
        quote_id: quoteId,
        product_id: prod.id,
        sort_order: i + 1,
        quantity: qty,
        list_price: prod.list_price,
        discount_type: 'percentage',
        discount_value: discountPct,
        unit_price: Math.round(unitPrice * 100) / 100,
        discount_approved: ['approved', 'sent_to_customer'].includes(spec.status),
        discount_approved_by: ['approved', 'sent_to_customer'].includes(spec.status) ? orgU.cm.id : null,
        notes: null,
        created_at: created.toISOString(),
      });
    }

    const totalAmount = subtotal - totalDiscount;
    const isApproved = ['approved', 'sent_to_customer'].includes(spec.status);
    const requiresApproval = totalDiscount / subtotal > 0.15;

    await knex('quotes').insert({
      id: quoteId,
      quote_number: quoteNumber,
      deal_id: spec.dealIndex !== null ? dealIds[spec.dealIndex] : null,
      organization_id: spec.org.id,
      created_by: creator.id,
      customer_name: spec.customerName,
      customer_email: spec.customerEmail,
      subtotal: Math.round(subtotal * 100) / 100,
      total_discount: Math.round(totalDiscount * 100) / 100,
      tax_amount: 0,
      total_amount: Math.round(totalAmount * 100) / 100,
      status: spec.status,
      requires_approval: requiresApproval,
      approved_by: isApproved ? orgU.cm.id : null,
      approved_at: isApproved ? daysAgo(spec.daysAgoCreated - 3).toISOString() : null,
      rejection_reason: spec.status === 'rejected' ? 'Discount exceeds approved threshold for this tier' : null,
      valid_from: isoDate(created),
      valid_until: isoDate(daysAgo(spec.daysAgoCreated - 30)),
      payment_terms: 'Net 30',
      notes: `Quote for ${spec.customerName}`,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });

    // Insert line items
    for (const item of lineItems) {
      await knex('quote_line_items').insert(item);
    }

    // Quote status history
    const qTransitions: { from: string | null; to: string; dAgo: number }[] = [
      { from: null, to: 'draft', dAgo: spec.daysAgoCreated },
    ];
    if (spec.status !== 'draft') {
      qTransitions.push({ from: 'draft', to: 'pending_approval', dAgo: spec.daysAgoCreated - 1 });
    }
    if (['approved', 'sent_to_customer'].includes(spec.status)) {
      qTransitions.push({ from: 'pending_approval', to: 'approved', dAgo: spec.daysAgoCreated - 3 });
    }
    if (spec.status === 'sent_to_customer') {
      qTransitions.push({ from: 'approved', to: 'sent_to_customer', dAgo: spec.daysAgoCreated - 5 });
    }
    if (spec.status === 'rejected') {
      qTransitions.push({ from: 'pending_approval', to: 'rejected', dAgo: spec.daysAgoCreated - 2 });
    }

    for (const t of qTransitions) {
      await knex('quote_status_history').insert({
        id: uuidv4(),
        quote_id: quoteId,
        from_status: t.from,
        to_status: t.to,
        changed_by: t.to === 'draft' || t.to === 'pending_approval' ? creator.id : orgU.cm.id,
        created_at: daysAgo(Math.max(t.dAgo, 0)).toISOString(),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADS (28 total)
  // ═══════════════════════════════════════════════════════════════════════════

  type LeadSpec = {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    industry: string;
    source: string;
    status: string;
    score: number;
    assignedOrg: any | null;
    daysAgoCreated: number;
    budget: number;
    convertedDealIndex?: number;
  };

  const leadSpecs: LeadSpec[] = [
    // Converted (linked to won deals)
    { firstName: 'John',     lastName: 'Smith',     email: 'jsmith@acmefinancial.com',  company: 'Acme Financial Corp',  industry: 'Financial Services', source: 'website',  status: 'converted',     score: 92, assignedOrg: cybershield, daysAgoCreated: 170, budget: 2000000, convertedDealIndex: 0 },
    { firstName: 'Maria',    lastName: 'Garcia',    email: 'mgarcia@globalbank.com',    company: 'GlobalBank Holdings',  industry: 'Banking',            source: 'event',    status: 'converted',     score: 88, assignedOrg: cybershield, daysAgoCreated: 155, budget: 600000, convertedDealIndex: 1 },
    { firstName: 'Alex',     lastName: 'Chen',      email: 'achen@cloudnine.com',       company: 'CloudNine Enterprises', industry: 'Technology',         source: 'referral', status: 'converted',     score: 90, assignedOrg: cloudguard,  daysAgoCreated: 160, budget: 750000, convertedDealIndex: 12 },
    { firstName: 'Robert',   lastName: 'Patel',     email: 'rpatel@pharmacore.com',     company: 'PharmaCore Labs',      industry: 'Pharmaceuticals',    source: 'marketing', status: 'converted',    score: 85, assignedOrg: cloudguard,  daysAgoCreated: 140, budget: 500000, convertedDealIndex: 13 },
    { firstName: 'Patricia', lastName: 'Williams',  email: 'pwilliams@govsecure.gov',   company: 'GovSecure Agency',     industry: 'Government',         source: 'event',    status: 'converted',     score: 82, assignedOrg: netsecure,   daysAgoCreated: 150, budget: 100000, convertedDealIndex: 22 },
    { firstName: 'Sandra',   lastName: 'Brown',     email: 'sbrown@insuretech.com',     company: 'InsureTech Global',    industry: 'Insurance',          source: 'website',  status: 'converted',     score: 78, assignedOrg: cloudguard,  daysAgoCreated: 115, budget: 150000, convertedDealIndex: 14 },
    { firstName: 'David',    lastName: 'Walsh',     email: 'dwalsh@northstar.com',      company: 'NorthStar Logistics',  industry: 'Logistics',          source: 'referral', status: 'converted',     score: 80, assignedOrg: netsecure,   daysAgoCreated: 130, budget: 80000, convertedDealIndex: 23 },
    { firstName: 'Linda',    lastName: 'Kim',       email: 'lkim@edutech.edu',          company: 'EduTech Solutions',    industry: 'Education',          source: 'marketing', status: 'converted',    score: 72, assignedOrg: techdefend,  daysAgoCreated: 100, budget: 60000, convertedDealIndex: 30 },

    // Accepted — actively being worked
    { firstName: 'Carlos',   lastName: 'Mendez',    email: 'cmendez@solarwinds.com',    company: 'SolarWinds Energy',    industry: 'Energy',             source: 'website',  status: 'accepted',      score: 85, assignedOrg: cybershield, daysAgoCreated: 18,  budget: 350000 },
    { firstName: 'Yuki',     lastName: 'Tanaka',    email: 'ytanaka@nippontech.co.jp',  company: 'Nippon Tech Corp',     industry: 'Technology',         source: 'event',    status: 'accepted',      score: 78, assignedOrg: cybershield, daysAgoCreated: 22,  budget: 420000 },
    { firstName: 'Hannah',   lastName: 'Fischer',   email: 'hfischer@eurobank.de',      company: 'EuroBank AG',          industry: 'Banking',            source: 'referral', status: 'accepted',      score: 82, assignedOrg: cloudguard,  daysAgoCreated: 15,  budget: 280000 },
    { firstName: 'Raj',      lastName: 'Sharma',    email: 'rsharma@techcorp.in',       company: 'TechCorp India',       industry: 'IT Services',        source: 'marketing', status: 'accepted',     score: 74, assignedOrg: netsecure,   daysAgoCreated: 20,  budget: 95000 },
    { firstName: 'Claire',   lastName: 'Dubois',    email: 'cdubois@frenchretail.fr',   company: 'French Retail Group',  industry: 'Retail',             source: 'event',    status: 'accepted',      score: 70, assignedOrg: techdefend,  daysAgoCreated: 12,  budget: 55000 },

    // Assigned — waiting for partner acceptance
    { firstName: 'Omar',     lastName: 'Hassan',    email: 'ohassan@mideastfin.ae',     company: 'MidEast Finance',      industry: 'Financial Services', source: 'website',  status: 'assigned',      score: 76, assignedOrg: cybershield, daysAgoCreated: 5,   budget: 500000 },
    { firstName: 'Mei',      lastName: 'Wong',      email: 'mwong@asiacloud.sg',        company: 'AsiaCloud Pte',        industry: 'Cloud Services',     source: 'referral', status: 'assigned',      score: 68, assignedOrg: cloudguard,  daysAgoCreated: 3,   budget: 200000 },
    { firstName: 'Erik',     lastName: 'Johansson', email: 'ejohansson@nordichealth.se', company: 'Nordic Health AB',     industry: 'Healthcare',         source: 'event',    status: 'assigned',      score: 72, assignedOrg: netsecure,   daysAgoCreated: 4,   budget: 120000 },
    { firstName: 'Priya',    lastName: 'Nair',      email: 'pnair@govtech.in',          company: 'GovTech India',        industry: 'Government',         source: 'marketing', status: 'assigned',     score: 65, assignedOrg: techdefend,  daysAgoCreated: 2,   budget: 45000 },

    // New — unassigned
    { firstName: 'Lucas',    lastName: 'Mueller',   email: 'lmueller@autoworks.de',     company: 'AutoWorks GmbH',       industry: 'Manufacturing',      source: 'website',  status: 'new',           score: 60, assignedOrg: null,        daysAgoCreated: 1,   budget: 180000 },
    { firstName: 'Sofia',    lastName: 'Rossi',     email: 'srossi@italianfood.it',     company: 'Italian Food SpA',     industry: 'Retail',             source: 'marketing', status: 'new',          score: 45, assignedOrg: null,        daysAgoCreated: 1,   budget: 75000 },
    { firstName: 'James',    lastName: 'O\'Connor', email: 'joconnor@irishpharma.ie',   company: 'Irish Pharma Ltd',     industry: 'Pharmaceuticals',    source: 'website',  status: 'new',           score: 55, assignedOrg: null,        daysAgoCreated: 0,   budget: 200000 },

    // Returned
    { firstName: 'Ahmed',    lastName: 'Al-Rashid', email: 'aalrashid@gulfco.ae',       company: 'Gulf Corp',            industry: 'Energy',             source: 'referral', status: 'returned',      score: 40, assignedOrg: null,        daysAgoCreated: 25,  budget: 150000 },
    { firstName: 'Tomoko',   lastName: 'Sato',      email: 'tsato@japanbank.co.jp',     company: 'Japan National Bank',  industry: 'Banking',            source: 'event',    status: 'returned',      score: 35, assignedOrg: null,        daysAgoCreated: 30,  budget: 300000 },
    { firstName: 'Karl',     lastName: 'Weber',     email: 'kweber@deutchmed.de',       company: 'DeutchMed Systems',    industry: 'Medical Devices',    source: 'marketing', status: 'returned',     score: 42, assignedOrg: null,        daysAgoCreated: 20,  budget: 110000 },

    // Disqualified
    { firstName: 'Ivan',     lastName: 'Petrov',    email: 'ipetrov@startup.xyz',       company: 'Startup XYZ',          industry: 'Technology',         source: 'website',  status: 'disqualified',  score: 20, assignedOrg: cybershield, daysAgoCreated: 60,  budget: 5000 },
    { firstName: 'Nina',     lastName: 'Kowalski',  email: 'nkowalski@budgetco.pl',     company: 'BudgetCo',             industry: 'Retail',             source: 'marketing', status: 'disqualified', score: 25, assignedOrg: netsecure,   daysAgoCreated: 50,  budget: 8000 },

    // SLA breached
    { firstName: 'Wei',      lastName: 'Zhang',     email: 'wzhang@chinatech.cn',       company: 'ChinaTech Corp',       industry: 'Technology',         source: 'website',  status: 'assigned',      score: 70, assignedOrg: techdefend,  daysAgoCreated: 8,   budget: 250000 },
    { firstName: 'Ana',      lastName: 'Silva',     email: 'asilva@brazilfin.br',       company: 'Brazil Finance SA',    industry: 'Financial Services', source: 'event',    status: 'assigned',      score: 62, assignedOrg: netsecure,   daysAgoCreated: 7,   budget: 180000 },

    // Extra accepted
    { firstName: 'Marco',    lastName: 'Bianchi',   email: 'mbianchi@euromed.it',       company: 'EuroMed Healthcare',   industry: 'Healthcare',         source: 'referral', status: 'accepted',      score: 88, assignedOrg: cybershield, daysAgoCreated: 10,  budget: 600000 },
  ];

  let leadSeq = 1;

  for (const spec of leadSpecs) {
    const leadId = uuidv4();
    const created = daysAgo(spec.daysAgoCreated);
    const leadNumber = `LD-2026-${String(leadSeq++).padStart(5, '0')}`;

    const assignedUserId = spec.assignedOrg
      ? pick([orgUsers[spec.assignedOrg.id].admin, orgUsers[spec.assignedOrg.id].rep]).id
      : null;

    const slaDeadline = spec.assignedOrg && ['assigned'].includes(spec.status)
      ? new Date(created.getTime() + 48 * 60 * 60 * 1000)
      : null;

    await knex('leads').insert({
      id: leadId,
      lead_number: leadNumber,
      source: spec.source,
      campaign_name: spec.source === 'marketing' ? pick(['Q1 Cloud Campaign', 'SASE Webinar Series', 'Security Summit 2026', 'Digital Transformation Drive']) : null,
      first_name: spec.firstName,
      last_name: spec.lastName,
      email: spec.email,
      company_name: spec.company,
      title: pick(['CTO', 'CISO', 'VP Engineering', 'IT Director', 'Security Manager', 'CIO', 'Head of Infrastructure']),
      industry: spec.industry,
      company_size: pick(['1-50', '51-200', '201-1000', '1001-5000', '5000+']),
      country: pick(['US', 'CA', 'GB', 'DE', 'JP', 'AU', 'IN', 'SG', 'AE', 'BR']),
      status: spec.status,
      assigned_org_id: spec.assignedOrg?.id || null,
      assigned_user_id: assignedUserId,
      assigned_at: spec.assignedOrg ? created.toISOString() : null,
      accepted_at: ['accepted', 'converted'].includes(spec.status) ? daysAgo(spec.daysAgoCreated - 1).toISOString() : null,
      sla_deadline: slaDeadline?.toISOString() || null,
      score: spec.score,
      budget: spec.budget,
      timeline: pick(['Immediate', '1-3 months', '3-6 months', '6-12 months', 'Evaluating']),
      interest_notes: `Interested in ${pick(['network security', 'cloud security', 'SASE', 'XDR', 'SOAR', 'firewall upgrade', 'compliance'])} solution`,
      converted_deal_id: spec.convertedDealIndex !== undefined ? dealIds[spec.convertedDealIndex] : null,
      converted_at: spec.status === 'converted' ? daysAgo(spec.daysAgoCreated - randInt(5, 20)).toISOString() : null,
      return_reason: spec.status === 'returned' ? pick(['Outside territory', 'No budget confirmed', 'Duplicate lead', 'Unresponsive contact']) : null,
      disqualify_reason: spec.status === 'disqualified' ? pick(['Budget too small', 'Not a fit', 'Competitor committed', 'No authority']) : null,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MDF ALLOCATIONS & REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Q1 2026 allocations
  const allocationSpecs = [
    { org: cybershield, amount: 100000, spent: 45000 },
    { org: cloudguard,  amount: 50000,  spent: 22000 },
    { org: netsecure,   amount: 10000,  spent: 4000 },
    // TechDefend is Registered tier — no MDF
  ];

  const allocationIds: Record<string, string> = {};

  for (const spec of allocationSpecs) {
    const allocId = uuidv4();
    allocationIds[spec.org.id] = allocId;
    await knex('mdf_allocations').insert({
      id: allocId,
      organization_id: spec.org.id,
      fiscal_year: 2026,
      fiscal_quarter: 1,
      allocated_amount: spec.amount,
      spent_amount: spec.spent,
      notes: `Q1 2026 MDF allocation for ${spec.org.name}`,
      created_at: daysAgo(90).toISOString(),
      updated_at: daysAgo(5).toISOString(),
    });
  }

  // MDF Requests (12 total)
  type MdfSpec = {
    org: any;
    activityType: string;
    activityName: string;
    status: string;
    requestedAmount: number;
    daysAgoCreated: number;
  };

  const mdfSpecs: MdfSpec[] = [
    // CyberShield
    { org: cybershield, activityType: 'trade_show',       activityName: 'RSA Conference 2026 Booth',           status: 'reimbursed',      requestedAmount: 15000, daysAgoCreated: 80 },
    { org: cybershield, activityType: 'webinar',          activityName: 'Zero Trust Architecture Webinar',     status: 'reimbursed',      requestedAmount: 5000,  daysAgoCreated: 70 },
    { org: cybershield, activityType: 'digital_campaign', activityName: 'SASE Awareness Campaign Q1',         status: 'claim_approved',  requestedAmount: 8000,  daysAgoCreated: 50 },
    { org: cybershield, activityType: 'event',            activityName: 'Partner Security Summit',             status: 'completed',       requestedAmount: 12000, daysAgoCreated: 30 },
    { org: cybershield, activityType: 'training',         activityName: 'Team PCNSE Certification Training',  status: 'approved',        requestedAmount: 5000,  daysAgoCreated: 15 },

    // CloudGuard
    { org: cloudguard, activityType: 'digital_campaign',  activityName: 'Cloud Security LinkedIn Campaign',   status: 'claim_approved',  requestedAmount: 7000,  daysAgoCreated: 55 },
    { org: cloudguard, activityType: 'webinar',           activityName: 'Prisma Cloud Deep Dive Series',      status: 'completed',       requestedAmount: 4000,  daysAgoCreated: 35 },
    { org: cloudguard, activityType: 'event',             activityName: 'AWS re:Invent Partner Dinner',       status: 'approved',        requestedAmount: 8000,  daysAgoCreated: 20 },
    { org: cloudguard, activityType: 'print_collateral',  activityName: 'Cloud Security Solution Brief',      status: 'submitted',       requestedAmount: 3000,  daysAgoCreated: 8 },

    // NetSecure
    { org: netsecure, activityType: 'event',              activityName: 'Local CISO Roundtable',              status: 'completed',       requestedAmount: 2500, daysAgoCreated: 40 },
    { org: netsecure, activityType: 'digital_campaign',   activityName: 'Managed Firewall Email Campaign',    status: 'submitted',       requestedAmount: 1500, daysAgoCreated: 10 },
    { org: netsecure, activityType: 'webinar',            activityName: 'MSSP Best Practices Webinar',        status: 'draft',           requestedAmount: 2000, daysAgoCreated: 3 },
  ];

  let mdfSeq = 1;

  for (const spec of mdfSpecs) {
    const mdfId = uuidv4();
    const orgU = orgUsers[spec.org.id];
    const created = daysAgo(spec.daysAgoCreated);
    const mdfNumber = `MDF-2026-${String(mdfSeq++).padStart(5, '0')}`;
    const startDate = daysAgo(spec.daysAgoCreated - 10);
    const endDate = daysAgo(spec.daysAgoCreated - 11);
    const isReviewed = !['draft', 'submitted'].includes(spec.status);
    const approvedAmount = isReviewed ? Math.round(spec.requestedAmount * 0.9) : null;

    await knex('mdf_requests').insert({
      id: mdfId,
      request_number: mdfNumber,
      allocation_id: allocationIds[spec.org.id],
      organization_id: spec.org.id,
      submitted_by: orgU.admin.id,
      activity_type: spec.activityType,
      activity_name: spec.activityName,
      description: `${spec.activityName} — marketing activity to drive pipeline and brand awareness`,
      start_date: isoDate(startDate),
      end_date: isoDate(endDate),
      requested_amount: spec.requestedAmount,
      approved_amount: approvedAmount,
      actual_spend: ['reimbursed', 'claim_approved', 'completed'].includes(spec.status) ? Math.round(spec.requestedAmount * 0.85) : null,
      status: spec.status,
      reviewed_by: isReviewed ? orgU.cm.id : null,
      reviewed_at: isReviewed ? daysAgo(spec.daysAgoCreated - 5).toISOString() : null,
      claim_submitted_at: ['reimbursed', 'claim_approved'].includes(spec.status) ? daysAgo(spec.daysAgoCreated - 15).toISOString() : null,
      claim_amount: ['reimbursed', 'claim_approved'].includes(spec.status) ? Math.round(spec.requestedAmount * 0.85) : null,
      claim_notes: ['reimbursed', 'claim_approved'].includes(spec.status) ? 'All receipts and proof of execution attached' : null,
      reimbursement_amount: spec.status === 'reimbursed' ? Math.round(spec.requestedAmount * 0.85) : null,
      reimbursed_at: spec.status === 'reimbursed' ? daysAgo(spec.daysAgoCreated - 25).toISOString() : null,
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CERTIFICATIONS (24 records)
  // ═══════════════════════════════════════════════════════════════════════════

  const partnerUsers = [csAdmin, csRep, cgAdmin, cgRep, nsAdmin, nsRep, tdAdmin, tdRep];

  type CertSpec = {
    user: any;
    courseIndex: number;
    status: string;
    score: number | null;
    daysAgoCompleted: number | null;
    expiresInDays: number | null;
  };

  const certSpecs: CertSpec[] = [
    // CyberShield — well-certified (Diamond)
    { user: csAdmin, courseIndex: 0, status: 'passed', score: 92, daysAgoCompleted: 200, expiresInDays: 520 },
    { user: csAdmin, courseIndex: 1, status: 'passed', score: 88, daysAgoCompleted: 150, expiresInDays: 570 },
    { user: csAdmin, courseIndex: 3, status: 'passed', score: 85, daysAgoCompleted: 100, expiresInDays: 620 },
    { user: csRep,   courseIndex: 0, status: 'passed', score: 78, daysAgoCompleted: 180, expiresInDays: 540 },
    { user: csRep,   courseIndex: 1, status: 'passed', score: 82, daysAgoCompleted: 120, expiresInDays: 600 },
    { user: csRep,   courseIndex: 4, status: 'passed', score: 90, daysAgoCompleted: 60,  expiresInDays: 660 },

    // CloudGuard — good coverage (Platinum)
    { user: cgAdmin, courseIndex: 0, status: 'passed', score: 85, daysAgoCompleted: 300, expiresInDays: 20 },  // Expiring soon!
    { user: cgAdmin, courseIndex: 1, status: 'passed', score: 80, daysAgoCompleted: 250, expiresInDays: 470 },
    { user: cgAdmin, courseIndex: 3, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
    { user: cgRep,   courseIndex: 0, status: 'passed', score: 75, daysAgoCompleted: 350, expiresInDays: 10 },  // Expiring very soon!
    { user: cgRep,   courseIndex: 2, status: 'passed', score: 82, daysAgoCompleted: 90,  expiresInDays: 630 },
    { user: cgRep,   courseIndex: 4, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },

    // NetSecure — basic coverage (Innovator)
    { user: nsAdmin, courseIndex: 0, status: 'passed', score: 78, daysAgoCompleted: 200, expiresInDays: 520 },
    { user: nsAdmin, courseIndex: 1, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
    { user: nsRep,   courseIndex: 0, status: 'passed', score: 72, daysAgoCompleted: 280, expiresInDays: 25 },  // Expiring soon!
    { user: nsRep,   courseIndex: 2, status: 'failed', score: 58, daysAgoCompleted: null, expiresInDays: null },

    // TechDefend — minimal (Registered)
    { user: tdAdmin, courseIndex: 0, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
    { user: tdAdmin, courseIndex: 1, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
    { user: tdRep,   courseIndex: 0, status: 'passed', score: 71, daysAgoCompleted: 400, expiresInDays: -30 },  // Already expired!
    { user: tdRep,   courseIndex: 4, status: 'failed', score: 55, daysAgoCompleted: null, expiresInDays: null },

    // Extra certs for variety
    { user: csAdmin, courseIndex: 2, status: 'passed', score: 94, daysAgoCompleted: 50, expiresInDays: 670 },
    { user: csAdmin, courseIndex: 4, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
    { user: cgAdmin, courseIndex: 2, status: 'passed', score: 88, daysAgoCompleted: 70, expiresInDays: 650 },
    { user: nsAdmin, courseIndex: 4, status: 'enrolled', score: null, daysAgoCompleted: null, expiresInDays: null },
  ];

  for (const spec of certSpecs) {
    const course = courses[spec.courseIndex];
    const now = new Date();
    const completedAt = spec.daysAgoCompleted ? daysAgo(spec.daysAgoCompleted) : null;
    const expiresAt = spec.expiresInDays !== null
      ? new Date(now.getTime() + spec.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Handle already-expired certs
    const actualStatus = expiresAt && expiresAt < now ? 'expired' : spec.status;

    await knex('user_certifications').insert({
      id: uuidv4(),
      user_id: spec.user.id,
      course_id: course.id,
      status: actualStatus,
      score: spec.score,
      completed_at: completedAt?.toISOString() || null,
      certified_at: completedAt && spec.status === 'passed' ? completedAt.toISOString() : null,
      expires_at: expiresAt?.toISOString() || null,
      attempts: spec.status === 'failed' ? 1 : (spec.status === 'passed' ? randInt(1, 2) : 0),
      created_at: daysAgo(spec.daysAgoCompleted || randInt(5, 30)).toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS (20 recent notifications)
  // ═══════════════════════════════════════════════════════════════════════════

  type NotifSpec = {
    user: any;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    daysAgo: number;
  };

  const notifSpecs: NotifSpec[] = [
    { user: csAdmin, type: 'deal_update',             title: 'Deal DR-2026-00007 moved to Under Review',      body: 'Your deal for Pacific Energy Corp is now under review by the channel manager.',     isRead: false, daysAgo: 1 },
    { user: csAdmin, type: 'lead_assigned',           title: 'New lead assigned: Omar Hassan',                body: 'A new lead from MidEast Finance has been assigned to your organization.',           isRead: false, daysAgo: 2 },
    { user: csAdmin, type: 'certification_expiring',  title: 'PCNSA certification expiring for rep',          body: 'Lisa Zhang\'s PCNSA certification will expire soon. Schedule renewal.',             isRead: false, daysAgo: 3 },
    { user: csAdmin, type: 'mdf_update',              title: 'MDF request approved: Partner Security Summit', body: 'Your MDF request for $12,000 has been approved.',                                   isRead: true,  daysAgo: 10 },
    { user: csRep,   type: 'deal_update',             title: 'Deal approved: CloudNine - SASE',               body: 'Your deal DR-2026-00008 has been approved by the channel manager.',                 isRead: true,  daysAgo: 5 },
    { user: csRep,   type: 'lead_assigned',           title: 'New lead: Marco Bianchi from EuroMed',          body: 'You have been assigned a new lead. SLA: 48 hours.',                                isRead: false, daysAgo: 1 },

    { user: cgAdmin, type: 'deal_update',             title: 'Deal DR-2026-00016 approved',                   body: 'Your deal for DataStream Analytics has been approved.',                             isRead: true,  daysAgo: 8 },
    { user: cgAdmin, type: 'certification_expiring',  title: 'PCNSA certification expiring in 20 days',       body: 'Your PCNSA certification expires soon. Please schedule your renewal exam.',         isRead: false, daysAgo: 2 },
    { user: cgAdmin, type: 'quote_approval',          title: 'Quote QT-2026-00010 needs review',              body: 'A new quote for Acme Financial Corp requires your attention.',                      isRead: false, daysAgo: 1 },
    { user: cgRep,   type: 'lead_assigned',           title: 'New lead: Mei Wong from AsiaCloud',             body: 'A lead has been assigned to you. Please accept within 48 hours.',                   isRead: false, daysAgo: 3 },
    { user: cgRep,   type: 'certification_expiring',  title: 'PCNSA expiring in 10 days',                     body: 'Your PCNSA certification expires in 10 days. Immediate action required.',           isRead: false, daysAgo: 1 },

    { user: cm1,     type: 'deal_update',             title: '3 deals pending review',                        body: 'You have deals from CyberShield and CloudGuard awaiting your review.',              isRead: false, daysAgo: 1 },
    { user: cm1,     type: 'quote_approval',          title: 'Quote discount exceeds threshold',              body: 'Quote QT-2026-00004 requires CM approval (discount > 15%).',                       isRead: false, daysAgo: 2 },
    { user: cm1,     type: 'mdf_update',              title: 'New MDF request from CloudGuard',               body: 'CloudGuard submitted a $3,000 MDF request for print collateral.',                   isRead: false, daysAgo: 3 },

    { user: cm2,     type: 'deal_update',             title: 'NetSecure submitted 2 new deals',               body: 'NetSecure Partners has submitted deals for review.',                                isRead: false, daysAgo: 2 },
    { user: cm2,     type: 'lead_assigned',           title: 'Unaccepted leads approaching SLA',              body: 'Two leads assigned to NetSecure and TechDefend are nearing the 48hr SLA deadline.', isRead: false, daysAgo: 1 },

    { user: nsAdmin, type: 'deal_update',             title: 'Deal rejected: RetailMax project',              body: 'Your deal for RetailMax Inc was rejected. See notes for details.',                   isRead: true,  daysAgo: 15 },
    { user: nsRep,   type: 'certification_expiring',  title: 'PCNSA certification expiring in 25 days',       body: 'Your PCNSA certification expires soon. Book your renewal exam.',                    isRead: false, daysAgo: 5 },

    { user: tdAdmin, type: 'tier_change',             title: 'Welcome to the Partner Program',                 body: 'TechDefend LLC is now a Registered partner. Complete training to advance.',         isRead: true,  daysAgo: 40 },
    { user: tdAdmin, type: 'system_announcement',     title: 'New Q1 2026 products available',                 body: 'Check out the latest Cortex XSIAM and Prisma SASE offerings in the product catalog.', isRead: false, daysAgo: 7 },
  ];

  for (const spec of notifSpecs) {
    await knex('notifications').insert({
      id: uuidv4(),
      user_id: spec.user.id,
      type: spec.type,
      title: spec.title,
      body: spec.body,
      is_read: spec.isRead,
      read_at: spec.isRead ? daysAgo(spec.daysAgo - 1).toISOString() : null,
      action_url: null,
      created_at: daysAgo(spec.daysAgo).toISOString(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITY FEED (35 entries over past month)
  // ═══════════════════════════════════════════════════════════════════════════

  type ActivitySpec = {
    actor: any;
    org: any | null;
    action: string;
    entityType: string;
    summary: string;
    daysAgo: number;
  };

  const activitySpecs: ActivitySpec[] = [
    // Deal activities
    { actor: csAdmin, org: cybershield, action: 'created',  entityType: 'deal',  summary: 'Created deal DR-2026-00011 (draft)',                                       daysAgo: 2 },
    { actor: csRep,   org: cybershield, action: 'updated',  entityType: 'deal',  summary: 'Submitted deal DR-2026-00008 for review',                                  daysAgo: 5 },
    { actor: cm1,     org: cybershield, action: 'updated',  entityType: 'deal',  summary: 'Moved deal DR-2026-00007 to under_review',                                 daysAgo: 3 },
    { actor: cm1,     org: cybershield, action: 'approved', entityType: 'deal',  summary: 'Approved deal DR-2026-00005 — BioGenesis Research',                        daysAgo: 12 },
    { actor: cgAdmin, org: cloudguard,  action: 'created',  entityType: 'deal',  summary: 'Created deal DR-2026-00022 (draft)',                                       daysAgo: 3 },
    { actor: cgRep,   org: cloudguard,  action: 'updated',  entityType: 'deal',  summary: 'Submitted deal DR-2026-00017 with conflict flag',                          daysAgo: 8 },
    { actor: cm1,     org: cloudguard,  action: 'approved', entityType: 'deal',  summary: 'Approved deal DR-2026-00016 for DataStream Analytics',                     daysAgo: 10 },
    { actor: nsRep,   org: netsecure,   action: 'updated',  entityType: 'deal',  summary: 'Submitted deal DR-2026-00028 for review',                                  daysAgo: 4 },
    { actor: cm2,     org: netsecure,   action: 'rejected', entityType: 'deal',  summary: 'Rejected deal DR-2026-00029 — territory conflict',                        daysAgo: 15 },
    { actor: tdAdmin, org: techdefend,  action: 'created',  entityType: 'deal',  summary: 'Created deal DR-2026-00033 (draft)',                                       daysAgo: 1 },
    { actor: tdRep,   org: techdefend,  action: 'updated',  entityType: 'deal',  summary: 'Submitted deal DR-2026-00032 for review',                                  daysAgo: 6 },

    // Quote activities
    { actor: csAdmin, org: cybershield, action: 'created',  entityType: 'quote', summary: 'Created quote QT-2026-00005 for Pacific Energy Corp',                      daysAgo: 8 },
    { actor: cm1,     org: cybershield, action: 'approved', entityType: 'quote', summary: 'Approved quote QT-2026-00003 for AeroDefense Systems',                     daysAgo: 20 },
    { actor: cgAdmin, org: cloudguard,  action: 'created',  entityType: 'quote', summary: 'Created quote QT-2026-00009 for DataStream Analytics',                     daysAgo: 5 },
    { actor: cm2,     org: netsecure,   action: 'rejected', entityType: 'quote', summary: 'Rejected quote QT-2026-00014 — discount above threshold',                 daysAgo: 12 },

    // Lead activities
    { actor: cm1,     org: cybershield, action: 'assigned', entityType: 'lead',  summary: 'Assigned lead Omar Hassan (MidEast Finance) to CyberShield',              daysAgo: 5 },
    { actor: csRep,   org: cybershield, action: 'accepted', entityType: 'lead',  summary: 'Accepted lead Marco Bianchi from EuroMed Healthcare',                      daysAgo: 9 },
    { actor: cm1,     org: cloudguard,  action: 'assigned', entityType: 'lead',  summary: 'Assigned lead Mei Wong (AsiaCloud) to CloudGuard',                        daysAgo: 3 },
    { actor: cm2,     org: netsecure,   action: 'assigned', entityType: 'lead',  summary: 'Assigned lead Erik Johansson (Nordic Health) to NetSecure',               daysAgo: 4 },
    { actor: cm2,     org: techdefend,  action: 'assigned', entityType: 'lead',  summary: 'Assigned lead Priya Nair (GovTech India) to TechDefend',                  daysAgo: 2 },
    { actor: nsAdmin, org: netsecure,   action: 'returned', entityType: 'lead',  summary: 'Returned lead Ahmed Al-Rashid — outside territory',                       daysAgo: 20 },

    // MDF activities
    { actor: csAdmin, org: cybershield, action: 'created',  entityType: 'mdf',   summary: 'Submitted MDF request for Partner Security Summit ($12,000)',              daysAgo: 30 },
    { actor: cm1,     org: cybershield, action: 'approved', entityType: 'mdf',   summary: 'Approved MDF request MDF-2026-00005 for training',                         daysAgo: 10 },
    { actor: cgAdmin, org: cloudguard,  action: 'created',  entityType: 'mdf',   summary: 'Submitted MDF request for Cloud Security Solution Brief ($3,000)',        daysAgo: 8 },
    { actor: nsAdmin, org: netsecure,   action: 'created',  entityType: 'mdf',   summary: 'Saved draft MDF request for MSSP Best Practices Webinar',                 daysAgo: 3 },

    // Certification activities
    { actor: csRep,   org: cybershield, action: 'completed', entityType: 'certification', summary: 'Completed PCDRA certification with score 90',                     daysAgo: 7 },
    { actor: nsRep,   org: netsecure,   action: 'failed',    entityType: 'certification', summary: 'Failed PCSAE certification attempt (score: 58)',                   daysAgo: 14 },
    { actor: tdRep,   org: techdefend,  action: 'failed',    entityType: 'certification', summary: 'Failed PCDRA certification attempt (score: 55)',                   daysAgo: 21 },

    // System / admin activities
    { actor: admin,   org: null,        action: 'updated',  entityType: 'system', summary: 'Updated Q1 2026 MDF allocations for all partner tiers',                   daysAgo: 28 },
    { actor: admin,   org: null,        action: 'created',  entityType: 'system', summary: 'Published system announcement: New Q1 2026 products',                     daysAgo: 7 },
    { actor: cm1,     org: cybershield, action: 'updated',  entityType: 'organization', summary: 'Reviewed CyberShield Q4 2025 performance metrics',                  daysAgo: 25 },
    { actor: cm2,     org: netsecure,   action: 'updated',  entityType: 'organization', summary: 'Updated NetSecure partner scorecard',                               daysAgo: 18 },

    // Login activities
    { actor: csAdmin, org: cybershield, action: 'login',    entityType: 'user',  summary: 'David Kim logged in',                                                      daysAgo: 0 },
    { actor: cgAdmin, org: cloudguard,  action: 'login',    entityType: 'user',  summary: 'Emily Patel logged in',                                                    daysAgo: 0 },
    { actor: cm1,     org: null,        action: 'login',    entityType: 'user',  summary: 'Sarah Chen logged in',                                                     daysAgo: 0 },
  ];

  for (const spec of activitySpecs) {
    await knex('activity_feed').insert({
      id: uuidv4(),
      actor_id: spec.actor.id,
      organization_id: spec.org?.id || null,
      action: spec.action,
      entity_type: spec.entityType,
      entity_id: uuidv4(), // Placeholder entity reference
      summary: spec.summary,
      created_at: daysAgo(spec.daysAgo).toISOString(),
    });
  }

  // ─── Update sequences to avoid conflicts with future app-generated numbers ──
  await knex.raw(`SELECT setval('deal_number_seq', ${dealSpecs.length + 10})`);
  await knex.raw(`SELECT setval('quote_number_seq', ${quoteSpecs.length + 10})`);
  await knex.raw(`SELECT setval('lead_number_seq', ${leadSpecs.length + 10})`);
  await knex.raw(`SELECT setval('mdf_number_seq', ${mdfSpecs.length + 10})`);

  console.log('Demo data seeded successfully:');
  console.log(`  - ${dealSpecs.length} deals with products and status history`);
  console.log(`  - ${quoteSpecs.length} quotes with line items`);
  console.log(`  - ${leadSpecs.length} leads`);
  console.log(`  - ${Object.keys(allocationIds).length} MDF allocations + ${mdfSpecs.length} requests`);
  console.log(`  - ${certSpecs.length} user certifications`);
  console.log(`  - ${notifSpecs.length} notifications`);
  console.log(`  - ${activitySpecs.length} activity feed entries`);
}
