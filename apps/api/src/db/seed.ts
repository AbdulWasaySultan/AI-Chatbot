// Demo data: the three businesses from the original prototype, converted into the new model
// (plans/05 §5). Prices and facts that used to live inside system prompts are now structured
// services, hours and contacts. Run with `npm run db:seed` or automatically on first local start.
//
// Local demo login (development only — never seeded on a production database):
//   email:    demo@fj-tech.local
//   password: DemoPassword!2026
import { sql } from 'drizzle-orm';
import type { BusinessProfileInput } from '@fj/shared';
import { businessProfileSchema } from '@fj/shared';
import { loadConfig, type AppConfig } from '../config/env.ts';
import { createAuth } from '../auth/auth.ts';
import { createServices } from '../app.ts';
import { createDatabase, withSystemTx, type Db } from './client.ts';
import { organizations } from './schema.ts';
import type { WorkspaceContext } from '../http/context.ts';

export const DEMO_EMAIL = 'demo@fj-tech.local';
export const DEMO_PASSWORD = 'DemoPassword!2026';

const weekdays = (opens: string, closes: string) => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens, closes }));

interface DemoBusiness {
  name: string;
  industry: string;
  timezone: string;
  profile: Partial<BusinessProfileInput> & { displayName: string };
  agents: { name: string; displayName: string; role: string; tone: string; greeting: string; instructions: string }[];
}

const BUSINESSES: DemoBusiness[] = [
  {
    name: 'Apex Dental & Implant Studio',
    industry: 'Healthcare / Dental',
    timezone: 'America/New_York',
    profile: {
      displayName: 'Apex Dental & Implant Studio',
      description: 'Family, cosmetic and implant dentistry in Miami Beach, including same-day emergency appointments.',
      websiteUrl: 'https://apexdentalstudio.com',
      primaryPhone: '+1 (888) 412-9040',
      primaryEmail: 'info@apexdentalstudio.com',
      serviceAreas: ['Miami', 'Miami Beach', 'Coral Gables', 'South Florida'],
      locations: [
        {
          name: 'Main Office',
          isPrimary: true,
          street: '1250 Ocean Drive, Suite 400',
          city: 'Miami',
          region: 'FL',
          postalCode: '33139',
          country: 'USA',
          phone: '+1 (888) 412-9040',
          email: '',
          mapsUrl: '',
          notes: '',
          hoursConfigured: true,
          hours: [...weekdays('08:00', '18:00'), { weekday: 6, opens: '09:00', closes: '15:00' }],
        },
      ],
      contacts: [
        { kind: 'primary', name: 'Dr. Sarah Chen', role: 'Lead Dentist', phone: '+1 (888) 412-9040', email: 'info@apexdentalstudio.com', available24x7: false, notify: true, priority: 0 },
        { kind: 'department', name: 'Appointments', role: 'Appointments', phone: '+1 (888) 412-9041', email: 'appointments@apexdentalstudio.com', available24x7: false, notify: false, priority: 0 },
        { kind: 'department', name: 'Insurance & Billing', role: 'Billing', phone: '+1 (888) 412-9042', email: 'billing@apexdentalstudio.com', available24x7: false, notify: false, priority: 0 },
        { kind: 'escalation', name: 'Office Manager', role: 'Office Manager', phone: '+1 (888) 412-9040', email: 'manager@apexdentalstudio.com', available24x7: false, notify: true, priority: 0 },
        { kind: 'emergency', name: 'On-Call Dentist', role: 'On-Call Dentist', phone: '+1 (888) 412-9099', email: '', available24x7: true, notify: true, priority: 0 },
      ],
      services: [
        { name: 'Teeth cleaning', description: 'Without insurance.', priceType: 'fixed', priceMin: 125, priceMax: null, currency: 'USD', durationMinutes: 60, bookable: true, active: true },
        { name: 'Invisalign', description: 'All-inclusive treatment.', priceType: 'fixed', priceMin: 3900, priceMax: null, currency: 'USD', durationMinutes: null, bookable: false, active: true },
        { name: 'Zoom Whitening', description: '', priceType: 'fixed', priceMin: 299, priceMax: null, currency: 'USD', durationMinutes: 90, bookable: true, active: true },
        { name: 'Smile consultation', description: '15-minute consultation.', priceType: 'free', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: 15, bookable: true, active: true },
        { name: 'Emergency root canal', description: 'Same-day emergency appointments.', priceType: 'quote', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: null, bookable: true, active: true },
        { name: 'Cosmetic implant consultation', description: '', priceType: 'quote', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: 45, bookable: true, active: true },
      ],
      policies: [{ topic: 'insurance', title: 'Insurance', body: 'We accept Delta Dental, Cigna, and Aetna.' }],
    },
    agents: [
      {
        name: 'Sophia — Patient Receptionist',
        displayName: 'Sophia',
        role: 'Patient receptionist',
        tone: 'Warm and professional',
        greeting: 'Thank you for contacting Apex Dental Studio! This is Sophia. How can I help you today?',
        instructions: 'Help patients book cleanings, emergency root canals and cosmetic implant consultations. Always ask for the patient’s full name and preferred time.',
      },
      {
        name: 'Web Concierge',
        displayName: 'Apex Concierge',
        role: 'Website assistant',
        tone: 'Concise and friendly',
        greeting: 'Hi there! Welcome to Apex Dental Studio. Can I help with treatments, pricing or an appointment?',
        instructions: 'Answer questions about Invisalign, whitening and emergency appointments concisely. Offer the free 15-minute smile consultation.',
      },
    ],
  },
  {
    name: 'Vanguard Luxury Realty Group',
    industry: 'Real Estate',
    timezone: 'America/New_York',
    profile: {
      displayName: 'Vanguard Luxury Realty Group',
      description: 'Luxury residential real estate in Miami and Dubai.',
      websiteUrl: 'https://vanguardluxury.io',
      primaryPhone: '+1 (305) 990-8122',
      primaryEmail: 'sales@vanguardluxury.io',
      serviceAreas: ['Miami', 'Brickell', 'Star Island', 'Coral Gables', 'Dubai', 'Palm Jumeirah'],
      locations: [
        {
          name: 'Miami Headquarters',
          isPrimary: true,
          street: '999 Brickell Avenue, Penthouse Suite',
          city: 'Miami',
          region: 'FL',
          postalCode: '33131',
          country: 'USA',
          phone: '+1 (305) 990-8122',
          email: '',
          mapsUrl: '',
          notes: '',
          hoursConfigured: true,
          hours: [...weekdays('09:00', '19:00'), { weekday: 6, opens: '10:00', closes: '17:00' }, { weekday: 0, opens: '11:00', closes: '16:00' }],
        },
        {
          name: 'Dubai Office',
          isPrimary: false,
          street: 'Palm Jumeirah Tower, Level 42',
          city: 'Dubai',
          region: '',
          postalCode: '',
          country: 'UAE',
          phone: '+971 4 555 8900',
          email: '',
          mapsUrl: '',
          notes: '',
          hoursConfigured: false,
          hours: [],
        },
      ],
      contacts: [
        { kind: 'primary', name: 'James Whitfield', role: 'Senior Broker', phone: '+1 (305) 990-8122', email: 'james@vanguardluxury.io', available24x7: false, notify: true, priority: 0 },
        { kind: 'department', name: 'Sales', role: 'Sales', phone: '+1 (305) 990-8123', email: 'sales@vanguardluxury.io', available24x7: false, notify: false, priority: 0 },
        { kind: 'department', name: 'Rentals', role: 'Rentals', phone: '+1 (305) 990-8124', email: 'rentals@vanguardluxury.io', available24x7: false, notify: false, priority: 0 },
        { kind: 'escalation', name: 'James Whitfield', role: 'Senior Broker', phone: '+1 (305) 990-8122', email: 'james@vanguardluxury.io', available24x7: false, notify: true, priority: 0 },
        { kind: 'emergency', name: 'VIP Concierge', role: 'VIP Concierge', phone: '+1 (305) 990-8100', email: '', available24x7: true, notify: true, priority: 0 },
      ],
      services: [
        { name: 'Private property viewing', description: 'With a senior broker.', priceType: 'free', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: 60, bookable: true, active: true },
        { name: 'Buyer consultation', description: '', priceType: 'free', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: 30, bookable: true, active: true },
      ],
      policies: [],
    },
    agents: [
      {
        name: 'Marcus — Lead Qualifier',
        displayName: 'Marcus',
        role: 'Property specialist',
        tone: 'Executive and confident',
        greeting: "Hello, you've reached Vanguard Luxury Realty. I'm Marcus. Are you looking to buy, sell, or schedule a private viewing?",
        instructions: 'Qualify buyers by asking for their budget range, preferred neighborhood (Brickell, Star Island, Palm Jumeirah) and timeline. Offer to book a private showing with a senior broker. Featured listings: The Residences at Brickell ($3.4M, 4 bed / 4.5 bath, private elevator) and Coral Gables Waterfront Villa ($6.8M, private dock).',
      },
    ],
  },
  {
    name: 'Solaris Home Energy & HVAC',
    industry: 'Home Services & Solar',
    timezone: 'America/New_York',
    profile: {
      displayName: 'Solaris Home Energy & HVAC',
      description: 'Emergency AC and heating repair and $0-down solar installations in the Tampa Bay area.',
      websiteUrl: 'https://solarishome.energy',
      primaryPhone: '+1 (800) 755-2390',
      primaryEmail: 'service@solarishome.energy',
      serviceAreas: ['Tampa', 'St. Petersburg', 'Clearwater', 'Central Florida'],
      locations: [
        {
          name: 'Tampa Office',
          isPrimary: true,
          street: '4500 Solar Parkway',
          city: 'Tampa',
          region: 'FL',
          postalCode: '33602',
          country: 'USA',
          phone: '+1 (800) 755-2390',
          email: '',
          mapsUrl: '',
          notes: '',
          hoursConfigured: true,
          hours: [...weekdays('07:00', '20:00'), { weekday: 6, opens: '08:00', closes: '17:00' }, { weekday: 0, opens: '09:00', closes: '15:00' }],
        },
      ],
      contacts: [
        { kind: 'primary', name: 'Mike Rodriguez', role: 'Service Manager', phone: '+1 (800) 755-2390', email: 'service@solarishome.energy', available24x7: false, notify: true, priority: 0 },
        { kind: 'department', name: 'Emergency HVAC', role: 'Emergency HVAC', phone: '+1 (800) 755-2391', email: 'emergency@solarishome.energy', available24x7: false, notify: false, priority: 0 },
        { kind: 'department', name: 'Solar Consultations', role: 'Solar', phone: '+1 (800) 755-2392', email: 'solar@solarishome.energy', available24x7: false, notify: false, priority: 0 },
        { kind: 'escalation', name: 'Mike Rodriguez', role: 'Service Manager', phone: '+1 (800) 755-2390', email: 'service@solarishome.energy', available24x7: false, notify: true, priority: 0 },
        { kind: 'emergency', name: '24/7 Emergency Dispatch', role: 'Dispatch', phone: '+1 (800) 755-2399', email: '', available24x7: true, notify: true, priority: 0 },
      ],
      services: [
        { name: 'AC / heating diagnostic visit', description: 'Fee waived if you go ahead with the repair. Technicians dispatched within 2 hours for emergencies.', priceType: 'fixed', priceMin: 89, priceMax: null, currency: 'USD', durationMinutes: null, bookable: true, active: true },
        { name: 'Solar assessment', description: 'Includes 30% federal solar tax credit eligibility check.', priceType: 'free', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: 45, bookable: true, active: true },
        { name: 'Solar panel installation', description: '$0-down financing available.', priceType: 'quote', priceMin: null, priceMax: null, currency: 'USD', durationMinutes: null, bookable: false, active: true },
      ],
      policies: [],
    },
    agents: [
      {
        name: 'Elena — Dispatch & Solar',
        displayName: 'Elena',
        role: 'Service coordinator',
        tone: 'Energetic and clear',
        greeting: "Hi! Thanks for contacting Solaris Home Energy. I'm Elena. Is this about emergency AC or heating repair, or a solar assessment?",
        instructions: 'Dispatch emergency AC and heating technicians and qualify homeowners for solar. For solar, ask for their average monthly electric bill and roof age.',
      },
    ],
  },
];

export async function isEmpty(db: Db): Promise<boolean> {
  const res = await withSystemTx(db, (tx) => tx.execute(sql`select count(*)::int as n from ${organizations}`));
  return ((res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0) === 0;
}

export async function seedDemoData(db: Db, config: AppConfig) {
  const auth = createAuth(db, config);
  const services = createServices(db);
  const signUp = await auth.api.signUpEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo Owner' } });
  const userId = signUp.user.id;
  const org = await services.tenancy.createOrganization(userId, { name: 'FJ-Tech Solutions', kind: 'agency' });

  for (const business of BUSINESSES) {
    const ws = await services.tenancy.createWorkspace(userId, org.id, {
      name: business.name,
      industry: business.industry,
      timezone: business.timezone,
      locale: 'en',
    });
    const ctx: WorkspaceContext = {
      organizationId: org.id,
      workspaceId: ws.id,
      workspaceName: ws.name,
      timezone: ws.timezone,
      userId,
      orgRole: 'owner',
      role: 'admin',
    };
    await services.profile.replace(ctx, businessProfileSchema.parse(business.profile));
    for (const a of business.agents) {
      const agent = await services.agents.create(ctx, {
        name: a.name,
        config: {
          persona: { displayName: a.displayName, role: a.role, tone: a.tone, language: 'en', greeting: a.greeting },
          instructions: a.instructions,
        },
      });
      await services.agents.publish(ctx, agent.id, 'Imported from the original prototype');
    }
  }
  return { email: DEMO_EMAIL, organizationId: org.id };
}

// `npm run db:seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const database = await createDatabase(config.databaseUrl);
  await database.migrate();
  if (config.isProd) throw new Error('Refusing to seed demo data in production.');
  if (!(await isEmpty(database.db))) {
    console.log('Database already has data; skipping seed.');
  } else {
    const result = await seedDemoData(database.db, config);
    console.log(`Seeded demo data. Sign in as ${result.email}.`);
  }
  await database.close();
}
