import { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const BCRYPT_ROUNDS = 12;

// Fixed UUIDs for referential integrity
const TIER_IDS = {
  registered: uuidv4(),
  innovator: uuidv4(),
  platinum: uuidv4(),
  diamond: uuidv4(),
};

const CATEGORY_IDS = {
  networkSecurity: uuidv4(),
  sase: uuidv4(),
  cloudSecurity: uuidv4(),
  securityOps: uuidv4(),
  professionalServices: uuidv4(),
};

const ORG_IDS = {
  cybershield: uuidv4(),
  cloudguard: uuidv4(),
  netsecure: uuidv4(),
  techdefend: uuidv4(),
};

const USER_IDS = {
  admin: uuidv4(),
  cm1: uuidv4(),
  cm2: uuidv4(),
  cybershieldAdmin: uuidv4(),
  cybershieldRep: uuidv4(),
  cloudguardAdmin: uuidv4(),
  cloudguardRep: uuidv4(),
  netsecureAdmin: uuidv4(),
  netsecureRep: uuidv4(),
  techdefendAdmin: uuidv4(),
  techdefendRep: uuidv4(),
};

export async function seed(knex: Knex): Promise<void> {
  // Clean tables in dependency order
  await knex('activity_feed').del();
  await knex('approval_requests').del();
  await knex('notifications').del();
  await knex('documents').del();
  await knex('document_folders').del();
  await knex('user_certifications').del();
  await knex('courses').del();
  await knex('mdf_requests').del();
  await knex('mdf_allocations').del();
  await knex('quote_line_items').del();
  await knex('quotes').del();
  await knex('leads').del();
  await knex('deal_products').del();
  await knex('deal_status_history').del();
  await knex('deals').del();
  await knex('tier_product_pricing').del();
  await knex('products').del();
  await knex('product_categories').del();
  await knex('users').del();
  // Remove FK constraint temporarily to clear orgs
  await knex.raw('UPDATE organizations SET channel_manager_id = NULL');
  await knex('organizations').del();
  await knex('partner_tiers').del();

  const passwordHash = await bcrypt.hash('Demo123!', BCRYPT_ROUNDS);

  // ===== TIERS =====
  await knex('partner_tiers').insert([
    {
      id: TIER_IDS.registered,
      name: 'Registered',
      rank: 1,
      color_hex: '#6B7280',
      min_annual_revenue: 0,
      min_deals_closed: 0,
      min_certified_reps: 0,
      min_csat_score: 0,
      default_discount_pct: 0,
      max_discount_pct: 5,
      mdf_budget_pct: 0,
      lead_priority: 1,
      dedicated_channel_mgr: false,
      description: 'Entry-level partner tier. Access to basic partner resources and training.',
    },
    {
      id: TIER_IDS.innovator,
      name: 'Innovator',
      rank: 2,
      color_hex: '#3B82F6',
      min_annual_revenue: 100000,
      min_deals_closed: 5,
      min_certified_reps: 2,
      min_csat_score: 3.5,
      default_discount_pct: 5,
      max_discount_pct: 15,
      mdf_budget_pct: 2,
      lead_priority: 2,
      dedicated_channel_mgr: false,
      description: 'Growing partner demonstrating commitment to the platform.',
    },
    {
      id: TIER_IDS.platinum,
      name: 'Platinum Innovator',
      rank: 3,
      color_hex: '#8B5CF6',
      min_annual_revenue: 500000,
      min_deals_closed: 15,
      min_certified_reps: 5,
      min_csat_score: 4.0,
      default_discount_pct: 10,
      max_discount_pct: 25,
      mdf_budget_pct: 4,
      lead_priority: 3,
      dedicated_channel_mgr: true,
      description: 'Elite partner with deep technical expertise and proven sales track record.',
    },
    {
      id: TIER_IDS.diamond,
      name: 'Diamond Innovator',
      rank: 4,
      color_hex: '#1E3A5F',
      min_annual_revenue: 2000000,
      min_deals_closed: 40,
      min_certified_reps: 12,
      min_csat_score: 4.5,
      default_discount_pct: 15,
      max_discount_pct: 35,
      mdf_budget_pct: 6,
      lead_priority: 4,
      dedicated_channel_mgr: true,
      description: 'Top-tier strategic partner with the deepest commitment and highest performance.',
    },
  ]);

  // ===== ORGANIZATIONS =====
  await knex('organizations').insert([
    {
      id: ORG_IDS.cybershield,
      name: 'CyberShield Solutions',
      legal_name: 'CyberShield Solutions Inc.',
      domain: 'cybershield.com',
      tier_id: TIER_IDS.diamond,
      status: 'active',
      industry: 'Cybersecurity',
      employee_count: 250,
      website: 'https://cybershield.com',
      phone: '+1-555-100-1000',
      address_line1: '100 Security Blvd',
      city: 'San Jose',
      state_province: 'CA',
      postal_code: '95134',
      country: 'US',
      ytd_revenue: 2450000,
      lifetime_revenue: 8500000,
      ytd_deals_closed: 42,
      certified_rep_count: 15,
    },
    {
      id: ORG_IDS.cloudguard,
      name: 'CloudGuard Inc',
      legal_name: 'CloudGuard Incorporated',
      domain: 'cloudguard.io',
      tier_id: TIER_IDS.platinum,
      status: 'active',
      industry: 'Cloud Services',
      employee_count: 120,
      website: 'https://cloudguard.io',
      phone: '+1-555-200-2000',
      address_line1: '200 Cloud Ave',
      city: 'Seattle',
      state_province: 'WA',
      postal_code: '98101',
      country: 'US',
      ytd_revenue: 780000,
      lifetime_revenue: 3200000,
      ytd_deals_closed: 18,
      certified_rep_count: 7,
    },
    {
      id: ORG_IDS.netsecure,
      name: 'NetSecure Partners',
      legal_name: 'NetSecure Partners LLC',
      domain: 'netsecure.net',
      tier_id: TIER_IDS.innovator,
      status: 'active',
      industry: 'Managed Security',
      employee_count: 45,
      website: 'https://netsecure.net',
      phone: '+1-555-300-3000',
      address_line1: '300 Network Dr',
      city: 'Austin',
      state_province: 'TX',
      postal_code: '78701',
      country: 'US',
      ytd_revenue: 150000,
      lifetime_revenue: 450000,
      ytd_deals_closed: 6,
      certified_rep_count: 3,
    },
    {
      id: ORG_IDS.techdefend,
      name: 'TechDefend LLC',
      legal_name: 'TechDefend LLC',
      domain: 'techdefend.com',
      tier_id: TIER_IDS.registered,
      status: 'active',
      industry: 'IT Consulting',
      employee_count: 15,
      website: 'https://techdefend.com',
      phone: '+1-555-400-4000',
      address_line1: '400 Tech Lane',
      city: 'Denver',
      state_province: 'CO',
      postal_code: '80202',
      country: 'US',
      ytd_revenue: 0,
      lifetime_revenue: 0,
      ytd_deals_closed: 0,
      certified_rep_count: 0,
    },
  ]);

  // ===== USERS =====
  await knex('users').insert([
    // Admin
    {
      id: USER_IDS.admin,
      email: 'admin@prmportal.com',
      password_hash: passwordHash,
      role: 'admin',
      first_name: 'System',
      last_name: 'Admin',
      title: 'Platform Administrator',
      is_active: true,
      email_verified: true,
      organization_id: null,
    },
    // Channel Managers
    {
      id: USER_IDS.cm1,
      email: 'sarah.chen@prmportal.com',
      password_hash: passwordHash,
      role: 'channel_manager',
      first_name: 'Sarah',
      last_name: 'Chen',
      title: 'Senior Channel Manager',
      is_active: true,
      email_verified: true,
      organization_id: null,
    },
    {
      id: USER_IDS.cm2,
      email: 'marcus.johnson@prmportal.com',
      password_hash: passwordHash,
      role: 'channel_manager',
      first_name: 'Marcus',
      last_name: 'Johnson',
      title: 'Channel Alliance Manager',
      is_active: true,
      email_verified: true,
      organization_id: null,
    },
    // CyberShield (Diamond)
    {
      id: USER_IDS.cybershieldAdmin,
      email: 'admin@cybershield.com',
      password_hash: passwordHash,
      role: 'partner_admin',
      first_name: 'David',
      last_name: 'Kim',
      title: 'VP of Partnerships',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.cybershield,
    },
    {
      id: USER_IDS.cybershieldRep,
      email: 'rep@cybershield.com',
      password_hash: passwordHash,
      role: 'partner_rep',
      first_name: 'Lisa',
      last_name: 'Zhang',
      title: 'Security Sales Engineer',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.cybershield,
    },
    // CloudGuard (Platinum)
    {
      id: USER_IDS.cloudguardAdmin,
      email: 'admin@cloudguard.io',
      password_hash: passwordHash,
      role: 'partner_admin',
      first_name: 'Emily',
      last_name: 'Patel',
      title: 'Director of Cloud Alliances',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.cloudguard,
    },
    {
      id: USER_IDS.cloudguardRep,
      email: 'rep@cloudguard.io',
      password_hash: passwordHash,
      role: 'partner_rep',
      first_name: 'James',
      last_name: 'Wilson',
      title: 'Cloud Solutions Architect',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.cloudguard,
    },
    // NetSecure (Innovator)
    {
      id: USER_IDS.netsecureAdmin,
      email: 'admin@netsecure.net',
      password_hash: passwordHash,
      role: 'partner_admin',
      first_name: 'Robert',
      last_name: 'Martinez',
      title: 'Managing Partner',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.netsecure,
    },
    {
      id: USER_IDS.netsecureRep,
      email: 'rep@netsecure.net',
      password_hash: passwordHash,
      role: 'partner_rep',
      first_name: 'Anna',
      last_name: 'Thompson',
      title: 'Network Security Consultant',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.netsecure,
    },
    // TechDefend (Registered)
    {
      id: USER_IDS.techdefendAdmin,
      email: 'admin@techdefend.com',
      password_hash: passwordHash,
      role: 'partner_admin',
      first_name: 'Michael',
      last_name: 'Brown',
      title: 'Founder & CEO',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.techdefend,
    },
    {
      id: USER_IDS.techdefendRep,
      email: 'rep@techdefend.com',
      password_hash: passwordHash,
      role: 'partner_rep',
      first_name: 'Jennifer',
      last_name: 'Davis',
      title: 'IT Security Specialist',
      is_active: true,
      email_verified: true,
      organization_id: ORG_IDS.techdefend,
    },
  ]);

  // Assign channel managers to orgs
  await knex('organizations').where('id', ORG_IDS.cybershield).update({ channel_manager_id: USER_IDS.cm1 });
  await knex('organizations').where('id', ORG_IDS.cloudguard).update({ channel_manager_id: USER_IDS.cm1 });
  await knex('organizations').where('id', ORG_IDS.netsecure).update({ channel_manager_id: USER_IDS.cm2 });
  await knex('organizations').where('id', ORG_IDS.techdefend).update({ channel_manager_id: USER_IDS.cm2 });

  // ===== PRODUCT CATEGORIES =====
  await knex('product_categories').insert([
    { id: CATEGORY_IDS.networkSecurity, name: 'Network Security', sort_order: 1 },
    { id: CATEGORY_IDS.sase, name: 'SASE', sort_order: 2 },
    { id: CATEGORY_IDS.cloudSecurity, name: 'Cloud Security', sort_order: 3 },
    { id: CATEGORY_IDS.securityOps, name: 'Security Operations', sort_order: 4 },
    { id: CATEGORY_IDS.professionalServices, name: 'Professional Services', sort_order: 5 },
  ]);

  // ===== PRODUCTS =====
  const productIds: Record<string, string> = {};
  const products = [
    // Network Security
    { sku: 'PA-400-BASE', name: 'PA-400 Series Firewall', description: 'Entry-level next-generation firewall for branch offices', category_id: CATEGORY_IDS.networkSecurity, list_price: 2500, cost: 900, product_type: 'hardware', billing_cycle: 'one_time' },
    { sku: 'PA-1400-BASE', name: 'PA-1400 Series Firewall', description: 'Mid-range next-generation firewall for small to medium enterprise', category_id: CATEGORY_IDS.networkSecurity, list_price: 12000, cost: 4500, product_type: 'hardware', billing_cycle: 'one_time' },
    { sku: 'PA-3400-BASE', name: 'PA-3400 Series Firewall', description: 'High-performance firewall for enterprise campus and data center edge', category_id: CATEGORY_IDS.networkSecurity, list_price: 45000, cost: 16000, product_type: 'hardware', billing_cycle: 'one_time' },
    { sku: 'PA-5400-BASE', name: 'PA-5400 Series Firewall', description: 'Next-generation firewall for large enterprise and data center', category_id: CATEGORY_IDS.networkSecurity, list_price: 125000, cost: 45000, product_type: 'hardware', billing_cycle: 'one_time' },
    { sku: 'VM-SERIES-100', name: 'VM-Series Virtual Firewall - VM-100', description: 'Virtual next-generation firewall for cloud and virtualized environments', category_id: CATEGORY_IDS.networkSecurity, list_price: 6500, cost: 1500, product_type: 'software', billing_cycle: 'annual' },
    { sku: 'VM-SERIES-300', name: 'VM-Series Virtual Firewall - VM-300', description: 'Virtual next-generation firewall with enhanced throughput', category_id: CATEGORY_IDS.networkSecurity, list_price: 18000, cost: 4000, product_type: 'software', billing_cycle: 'annual' },
    { sku: 'CN-SERIES', name: 'CN-Series Container Firewall', description: 'Container-native next-generation firewall for Kubernetes', category_id: CATEGORY_IDS.networkSecurity, list_price: 15000, cost: 3500, product_type: 'software', billing_cycle: 'annual' },
    { sku: 'CLOUD-NGFW', name: 'Cloud NGFW', description: 'Cloud-delivered next-generation firewall as a service', category_id: CATEGORY_IDS.networkSecurity, list_price: 35000, cost: 8000, product_type: 'subscription', billing_cycle: 'annual' },
    // SASE
    { sku: 'PRISMA-ACCESS', name: 'Prisma Access', description: 'Cloud-delivered security platform for remote workforce', category_id: CATEGORY_IDS.sase, list_price: 85000, cost: 20000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'PRISMA-SDWAN', name: 'Prisma SD-WAN', description: 'Next-generation SD-WAN with integrated security', category_id: CATEGORY_IDS.sase, list_price: 25000, cost: 6000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'PRISMA-SASE-BUNDLE', name: 'Prisma SASE Bundle', description: 'Complete SASE solution: Prisma Access + SD-WAN + ADEM', category_id: CATEGORY_IDS.sase, list_price: 120000, cost: 28000, product_type: 'subscription', billing_cycle: 'annual' },
    // Cloud Security
    { sku: 'PRISMA-CLOUD-ENT', name: 'Prisma Cloud Enterprise', description: 'Comprehensive cloud-native application protection platform', category_id: CATEGORY_IDS.cloudSecurity, list_price: 95000, cost: 22000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'PRISMA-CLOUD-STD', name: 'Prisma Cloud Standard', description: 'Cloud security posture management and compliance', category_id: CATEGORY_IDS.cloudSecurity, list_price: 45000, cost: 10000, product_type: 'subscription', billing_cycle: 'annual' },
    // Security Operations
    { sku: 'CORTEX-XDR-PRO', name: 'Cortex XDR Pro', description: 'Extended detection and response with full analytics', category_id: CATEGORY_IDS.securityOps, list_price: 55000, cost: 12000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'CORTEX-XSOAR', name: 'Cortex XSOAR', description: 'Security orchestration, automation, and response', category_id: CATEGORY_IDS.securityOps, list_price: 75000, cost: 18000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'CORTEX-XSIAM', name: 'Cortex XSIAM', description: 'AI-driven security operations platform', category_id: CATEGORY_IDS.securityOps, list_price: 150000, cost: 35000, product_type: 'subscription', billing_cycle: 'annual' },
    { sku: 'CORTEX-XDR-STD', name: 'Cortex XDR Standard', description: 'Endpoint detection and response', category_id: CATEGORY_IDS.securityOps, list_price: 28000, cost: 6500, product_type: 'subscription', billing_cycle: 'annual' },
    // Professional Services
    { sku: 'UNIT42-IR', name: 'Unit 42 Incident Response', description: 'Expert incident response retainer service', category_id: CATEGORY_IDS.professionalServices, list_price: 200000, cost: 80000, product_type: 'service', billing_cycle: 'one_time' },
    { sku: 'UNIT42-RA', name: 'Unit 42 Risk Assessment', description: 'Comprehensive security risk assessment', category_id: CATEGORY_IDS.professionalServices, list_price: 50000, cost: 20000, product_type: 'service', billing_cycle: 'one_time' },
    { sku: 'PS-DEPLOYMENT', name: 'Professional Deployment Services', description: 'Expert deployment and configuration services', category_id: CATEGORY_IDS.professionalServices, list_price: 15000, cost: 6000, product_type: 'service', billing_cycle: 'one_time' },
  ];

  for (const product of products) {
    const id = uuidv4();
    productIds[product.sku] = id;
    await knex('products').insert({ id, ...product });
  }

  // ===== TIER PRODUCT PRICING =====
  const tierPricingRows: any[] = [];
  const allSkus = Object.keys(productIds);

  const tierDiscounts: Record<string, Record<string, number>> = {
    [TIER_IDS.registered]: {},
    [TIER_IDS.innovator]: {},
    [TIER_IDS.platinum]: {},
    [TIER_IDS.diamond]: {},
  };

  // Base discounts per tier (overridden per product where needed)
  const baseDiscounts: Record<string, number> = {
    [TIER_IDS.registered]: 0,
    [TIER_IDS.innovator]: 5,
    [TIER_IDS.platinum]: 12,
    [TIER_IDS.diamond]: 18,
  };

  for (const sku of allSkus) {
    const productId = productIds[sku];
    for (const [tierId, baseDiscount] of Object.entries(baseDiscounts)) {
      // Vary discounts slightly per product category for realism
      let discount = baseDiscount;
      if (sku.startsWith('PA-5400') || sku.startsWith('CORTEX-XSIAM')) {
        discount = Math.min(discount + 3, 40); // Higher margin products get better discounts
      }
      if (sku.startsWith('UNIT42') || sku.startsWith('PS-')) {
        discount = Math.max(discount - 2, 0); // Services have tighter margins
      }

      tierPricingRows.push({
        id: uuidv4(),
        tier_id: tierId,
        product_id: productId,
        discount_pct: discount,
      });
    }
  }

  await knex('tier_product_pricing').insert(tierPricingRows);

  // ===== COURSES =====
  await knex('courses').insert([
    {
      id: uuidv4(),
      name: 'Palo Alto Networks Certified Network Security Administrator (PCNSA)',
      description: 'Foundation certification for configuring and managing Palo Alto Networks next-generation firewalls.',
      course_type: 'exam',
      duration_hours: 40,
      passing_score: 70,
      certification_valid_months: 24,
      is_required: true,
      required_for_tier_id: TIER_IDS.innovator,
      is_active: true,
    },
    {
      id: uuidv4(),
      name: 'Palo Alto Networks Certified Network Security Engineer (PCNSE)',
      description: 'Advanced certification for designing, deploying, and troubleshooting Palo Alto Networks infrastructure.',
      course_type: 'exam',
      duration_hours: 80,
      passing_score: 75,
      certification_valid_months: 24,
      is_required: true,
      required_for_tier_id: TIER_IDS.platinum,
      is_active: true,
    },
    {
      id: uuidv4(),
      name: 'Palo Alto Networks Certified Security Automation Engineer (PCSAE)',
      description: 'Certification for automating security operations using Cortex XSOAR.',
      course_type: 'exam',
      duration_hours: 60,
      passing_score: 70,
      certification_valid_months: 24,
      is_required: false,
      is_active: true,
    },
    {
      id: uuidv4(),
      name: 'Palo Alto Networks Certified Cloud Security Engineer (PCCSE)',
      description: 'Certification for securing cloud environments with Prisma Cloud.',
      course_type: 'exam',
      duration_hours: 60,
      passing_score: 70,
      certification_valid_months: 24,
      is_required: false,
      is_active: true,
    },
    {
      id: uuidv4(),
      name: 'Palo Alto Networks Certified Detection and Remediation Analyst (PCDRA)',
      description: 'Certification for threat detection and response using Cortex XDR.',
      course_type: 'exam',
      duration_hours: 40,
      passing_score: 70,
      certification_valid_months: 24,
      is_required: false,
      is_active: true,
    },
  ]);
}
