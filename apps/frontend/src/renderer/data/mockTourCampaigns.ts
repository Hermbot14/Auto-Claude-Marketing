/**
 * Mock Tour Campaign Data
 * Based on major sporting events and tours
 */

import type { ContentCampaign } from '../../../shared/types/content-calendar';
import type { ContentType } from '../../../shared/types/content-calendar';

// Helper to create dates
const createDate = (year: number, month: number, day: number): Date => {
  return new Date(year, month - 1, day);
};

// Tour campaign categories
export type TourCampaignCategory =
  | 'sports-event'
  | 'concert-tour'
  | 'festival'
  | 'exhibition'
  | 'championship'
  | 'olympics';

// Tour campaign interface extending ContentCampaign
export interface TourCampaign extends ContentCampaign {
  category: TourCampaignCategory;
  venue?: string;
  location?: string;
  expectedAttendees?: number;
  ticketPriceRange?: string;
  website?: string;
  organizingBody?: string;
}

// Mock tour campaigns data
export const MOCK_TOUR_CAMPAIGNS: TourCampaign[] = [
  // 2026 Events
  {
    id: 'tour-001',
    title: 'FIH Pro League Hobart',
    description: 'International hockey tournament featuring world\'s top teams competing in Hobart, Tasmania.',
    contentType: 'event' as ContentType,
    status: 'in_progress', // In progress - preparing for event
    priority: 'high',
    phaseId: 'q1-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Secure venue booking',
      'Confirm participating teams',
      'Launch ticket sales',
      'Coordinate media coverage'
    ],
    userStories: [],
    category: 'sports-event',
    venue: 'Hobart International Hockey Centre',
    location: 'Hobart, Tasmania, Australia',
    expectedAttendees: 15000,
    ticketPriceRange: '$25 - $150',
    website: 'https://fih.proleague/hobart',
    organizingBody: 'International Hockey Federation (FIH)',
    scheduledDate: createDate(2026, 2, 10),
    dueDate: createDate(2026, 2, 16),
    estimatedHours: 2000,
    platforms: ['web', 'mobile'],
    tags: ['hockey', 'pro-league', 'international', '2026', 'sports']
  },
  {
    id: 'tour-002',
    title: 'World Baseball Classic Tokyo',
    description: 'Premier international baseball tournament featuring national teams from around the world.',
    contentType: 'event' as ContentType,
    status: 'planned', // Planned - upcoming event
    priority: 'high',
    phaseId: 'q1-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Stadium preparation complete',
      'Team accommodations secured',
      'Broadcast arrangements finalized',
      'Merchandise production'
    ],
    userStories: [],
    category: 'championship',
    venue: 'Tokyo Dome',
    location: 'Tokyo, Japan',
    expectedAttendees: 45000,
    ticketPriceRange: '¥5,000 - ¥50,000',
    website: 'https://wbc.baseball/tokyo',
    organizingBody: 'World Baseball Classic Inc.',
    scheduledDate: createDate(2026, 3, 4),
    dueDate: createDate(2026, 3, 10),
    estimatedHours: 2500,
    platforms: ['web', 'mobile', 'tv'],
    tags: ['baseball', 'wbc', 'championship', 'tokyo', '2026']
  },
  {
    id: 'tour-003',
    title: 'FIFA World Cup Socceroos Campaign',
    description: 'Australian national football team qualifying matches and World Cup campaign.',
    contentType: 'event' as ContentType,
    status: 'planned', // Planned - upcoming event
    priority: 'must',
    phaseId: 'q2-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Qualifying matches secured',
      'Training facilities booked',
      'Sponsor agreements finalized',
      'Fan engagement program launched'
    ],
    userStories: [],
    category: 'sports-event',
    venue: 'Multiple Venues',
    location: 'Australia',
    expectedAttendees: 500000,
    ticketPriceRange: '$50 - $500',
    website: 'https://footballaustralia.com.au/worldcup',
    organizingBody: 'Football Australia',
    scheduledDate: createDate(2026, 6, 12),
    dueDate: createDate(2026, 6, 26),
    estimatedHours: 5000,
    platforms: ['web', 'mobile', 'tv', 'social'],
    tags: ['football', 'soccer', 'world-cup', 'socceroos', '2026', 'fifa']
  },
  // 2027 Events
  {
    id: 'tour-004',
    title: 'Rugby World Cup 2027 Australia',
    description: 'The premier international rugby union tournament hosted across Australia.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'must',
    phaseId: 'q4-2027',
    dependencies: [],
    acceptanceCriteria: [
      'Stadium upgrades complete',
      'Volunteer program launched (10,000+ volunteers)',
      'International broadcast secured',
      'Tourism packages available'
    ],
    userStories: [],
    category: 'championship',
    venue: 'Multiple Stadiums',
    location: 'Australia (Sydney, Melbourne, Brisbane, Perth, Adelaide)',
    expectedAttendees: 800000,
    ticketPriceRange: '$100 - $1500',
    website: 'https://rugbyworldcup2027.com.au',
    organizingBody: 'World Rugby',
    scheduledDate: createDate(2027, 10, 1),
    dueDate: createDate(2027, 10, 30),
    estimatedHours: 8000,
    platforms: ['web', 'mobile', 'tv', 'social'],
    tags: ['rugby', 'world-cup', '2027', 'australia', 'championship']
  },
  // 2028 Events
  {
    id: 'tour-005',
    title: 'LA28 Olympics - Australian Team Campaign',
    description: 'Australian Olympic Team preparation and participation in Los Angeles 2028 Summer Olympics.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'must',
    phaseId: 'q3-2028',
    dependencies: [],
    acceptanceCriteria: [
      'Team selection process complete',
      'Training camp locations secured',
      'Sponsorship activation program',
      'Fan zone and viewing parties organized'
    ],
    userStories: [],
    category: 'olympics',
    venue: 'Multiple Venues across Los Angeles',
    location: 'Los Angeles, California, USA',
    expectedAttendees: 1000000,
    ticketPriceRange: '$50 - $1500',
    website: 'https://la28.org/australia',
    organizingBody: 'Australian Olympic Committee',
    scheduledDate: createDate(2028, 7, 12),
    dueDate: createDate(2028, 7, 30),
    estimatedHours: 10000,
    platforms: ['web', 'mobile', 'tv', 'social'],
    tags: ['olympics', 'la28', '2028', 'australia', 'summer-olympics']
  },
  // Additional Tour Events
  {
    id: 'tour-006',
    title: 'Australian Open Tennis 2026',
    description: 'Grand Slam tennis tournament at Melbourne Park.',
    contentType: 'event' as ContentType,
    status: 'under_review', // Under review - finalizing plans
    priority: 'high',
    phaseId: 'q1-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Court maintenance complete',
      'Ticketing system operational',
      'Player services arranged',
      'Hospitality packages ready'
    ],
    userStories: [],
    category: 'championship',
    venue: 'Melbourne Park',
    location: 'Melbourne, Victoria, Australia',
    expectedAttendees: 900000,
    ticketPriceRange: '$30 - $500',
    website: 'https://ausopen.com',
    organizingBody: 'Tennis Australia',
    scheduledDate: createDate(2026, 1, 12),
    dueDate: createDate(2026, 1, 26),
    estimatedHours: 3000,
    platforms: ['web', 'mobile', 'tv'],
    tags: ['tennis', 'grand-slam', '2026', 'australian-open']
  },
  {
    id: 'tour-007',
    title: 'Formula 1 Australian Grand Prix 2026',
    description: 'World championship Formula 1 motor race at Albert Park.',
    contentType: 'event' as ContentType,
    status: 'planned', // Planned - upcoming event
    priority: 'high',
    phaseId: 'q1-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Track certification complete',
      'Paddock facilities ready',
      'Corporate hospitality configured',
      'Fan zone attractions confirmed'
    ],
    userStories: [],
    category: 'sports-event',
    venue: 'Albert Park Circuit',
    location: 'Melbourne, Victoria, Australia',
    expectedAttendees: 450000,
    ticketPriceRange: '$100 - $2000',
    website: 'https://grandprix.com.au',
    organizingBody: 'Australian Grand Prix Corporation',
    scheduledDate: createDate(2026, 3, 20),
    dueDate: createDate(2026, 3, 22),
    estimatedHours: 2200,
    platforms: ['web', 'mobile', 'tv'],
    tags: ['f1', 'formula-1', 'motor-racing', '2026', 'grand-prix']
  },
  {
    id: 'tour-008',
    title: 'ICC T20 World Cup 2026',
    description: 'International cricket T20 tournament co-hosted by Australia and New Zealand.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'high',
    phaseId: 'q4-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Venue allocations finalized',
      'Ticket sales launched',
      'Broadcast agreements signed',
      'Merchandise range developed'
    ],
    userStories: [],
    category: 'championship',
    venue: 'Multiple Cricket Grounds',
    location: 'Australia & New Zealand',
    expectedAttendees: 600000,
    ticketPriceRange: '$40 - $400',
    website: 'https://t20worldcup.com',
    organizingBody: 'International Cricket Council',
    scheduledDate: createDate(2026, 10, 1),
    dueDate: createDate(2026, 10, 30),
    estimatedHours: 4000,
    platforms: ['web', 'mobile', 'tv', 'social'],
    tags: ['cricket', 't20', 'world-cup', '2026', 'icc']
  },
  {
    id: 'tour-009',
    title: 'Taylor Swift | The Eras Tour - Australia',
    description: 'Global concert tour phenomenon making Australian stops.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'high',
    phaseId: 'q1-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Venue contracts finalized',
      'Ticket sale coordination',
      'Fan pre-sale management',
      'Local promotion campaign'
    ],
    userStories: [],
    category: 'concert-tour',
    venue: 'Accor Stadium, Melbourne Cricket Ground',
    location: 'Sydney & Melbourne, Australia',
    expectedAttendees: 300000,
    ticketPriceRange: '$150 - $800',
    website: 'https://taylorswift.com/tour',
    organizingBody: 'Taylor Swift Productions',
    scheduledDate: createDate(2026, 2, 20),
    dueDate: createDate(2026, 2, 28),
    estimatedHours: 1800,
    platforms: ['web', 'mobile', 'social'],
    tags: ['concert', 'music', 'taylor-swift', '2026', 'eras-tour']
  },
  {
    id: 'tour-010',
    title: 'AFL Grand Final 2026',
    description: 'Australian Football League premiership decider at the MCG.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'must',
    phaseId: 'q3-2026',
    dependencies: [],
    acceptanceCriteria: [
      'MCG preparations complete',
      'Grand Final events schedule',
      'Corporate hospitality management',
      'Fan engagement activities'
    ],
    userStories: [],
    category: 'sports-event',
    venue: 'Melbourne Cricket Ground',
    location: 'Melbourne, Victoria, Australia',
    expectedAttendees: 100000,
    ticketPriceRange: '$80 - $500',
    website: 'https://afl.com.au/grand-final',
    organizingBody: 'Australian Football League',
    scheduledDate: createDate(2026, 9, 25),
    dueDate: createDate(2026, 9, 25),
    estimatedHours: 1500,
    platforms: ['web', 'mobile', 'tv'],
    tags: ['afl', 'football', 'grand-final', '2026', 'sport']
  },
  {
    id: 'tour-011',
    title: 'Sydney New Year\'s Eve 2026 Celebrations',
    description: 'World-renowned fireworks and harbor celebrations.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'high',
    phaseId: 'q4-2026',
    dependencies: [],
    acceptanceCriteria: [
      'Fireworks display design',
      'Harbor viewing arrangements',
      'Televised production setup',
      'Crowd management planning'
    ],
    userStories: [],
    category: 'festival',
    venue: 'Sydney Harbour',
    location: 'Sydney, NSW, Australia',
    expectedAttendees: 1000000,
    ticketPriceRange: 'Free - $500 (VIP areas)',
    website: 'https://sydneynewyearseve.com',
    organizingBody: 'City of Sydney',
    scheduledDate: createDate(2026, 12, 31),
    dueDate: createDate(2027, 1, 1),
    estimatedHours: 3000,
    platforms: ['web', 'mobile', 'tv'],
    tags: ['new-year', 'fireworks', 'sydney', 'harbour', '2027']
  },
  {
    id: 'tour-012',
    title: 'Brisbane 2032 Olympics - Preliminary Events',
    description: 'Early planning and test events for the Brisbane 2032 Summer Olympics.',
    contentType: 'event' as ContentType,
    status: 'planned',
    priority: 'should',
    phaseId: 'q2-2027',
    dependencies: [],
    acceptanceCriteria: [
      'Venue planning milestones',
      'Infrastructure updates',
      'Community engagement programs',
      'Volunteer recruitment trial'
    ],
    userStories: [],
    category: 'olympics',
    venue: 'Various Locations',
    location: 'Brisbane, Queensland, Australia',
    expectedAttendees: 50000,
    ticketPriceRange: 'N/A (Planning events)',
    website: 'https://brisbane2032.qld.gov.au',
    organizingBody: 'Brisbane 2032 Organizing Committee',
    scheduledDate: createDate(2027, 4, 1),
    dueDate: createDate(2027, 6, 30),
    estimatedHours: 2500,
    platforms: ['web', 'mobile', 'social'],
    tags: ['olympics', 'brisbane-2032', '2027', 'planning', 'preparations']
  }
];

// Helper to get campaigns by date range
export function getCampaignsByDateRange(
  campaigns: TourCampaign[],
  startDate: Date,
  endDate: Date
): TourCampaign[] {
  return campaigns.filter((campaign) => {
    const campaignStart = campaign.scheduledDate || new Date();
    const campaignEnd = campaign.dueDate || campaignStart;
    return campaignStart <= endDate && campaignEnd >= startDate;
  });
}

// Helper to get campaigns by category
export function getCampaignsByCategory(
  campaigns: TourCampaign[],
  category: TourCampaignCategory
): TourCampaign[] {
  return campaigns.filter((campaign) => campaign.category === category);
}

// Helper to get campaigns by year
export function getCampaignsByYear(
  campaigns: TourCampaign[],
  year: number
): TourCampaign[] {
  return campaigns.filter((campaign) => {
    const campaignStart = campaign.scheduledDate || new Date();
    return campaignStart.getFullYear() === year;
  });
}

// Helper to get upcoming campaigns
export function getUpcomingCampaigns(
  campaigns: TourCampaign[],
  count: number = 5
): TourCampaign[] {
  const now = new Date();
  return campaigns
    .filter((campaign) => {
      const campaignStart = campaign.scheduledDate || new Date();
      return campaignStart >= now;
    })
    .sort((a, b) => {
      const dateA = a.scheduledDate?.getTime() || 0;
      const dateB = b.scheduledDate?.getTime() || 0;
      return dateA - dateB;
    })
    .slice(0, count);
}

// Tour category configuration
export const TOUR_CATEGORY_CONFIG: Record<
  TourCampaignCategory,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  'sports-event': {
    label: 'Sports Event',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: 'Trophy'
  },
  'concert-tour': {
    label: 'Concert Tour',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: 'Music'
  },
  'festival': {
    label: 'Festival',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
    icon: 'Sparkles'
  },
  'exhibition': {
    label: 'Exhibition',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: 'GalleryHorizontal'
  },
  'championship': {
    label: 'Championship',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: 'Medal'
  },
  'olympics': {
    label: 'Olympics',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    icon: 'Flame'
  }
};
