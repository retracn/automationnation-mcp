// Tool definitions: each maps a small, agent-friendly input onto one AutomationNation Actor.
// Actor inputs always set the fields that have demo defaults (cities, competitors, appleAppIds…),
// so a tool call never picks up an example value from the Actor's input schema.
// format() shapes the rows returned to the agent; summary() reads the raw rows.

import { z } from 'zod';
import PRICES from './prices.js';
import { compact, downsample, formatSeconds, shape, truncate } from './format.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const price = (slug) => PRICES[slug] ?? 'see the Apify Store page';
const country = (what = 'Two-letter country code for Google, e.g. us, gb, de, in.') =>
    z.string().regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code').default('us').describe(what);
const language = () => z.string().min(2).max(5).default('en').describe('Interface language code, e.g. en, de, es, fr, ja.');
const maxResults = (def, max, noun) =>
    z.number().int().min(1).max(max).default(def).describe(`How many ${noun} to return, 1–${max}. Each result is billed, so ask for what you need.`);
const isUrl = (s) => /^https?:\/\//i.test(s);
const isPackageName = (s) => /^[a-z][\w]*(\.[\w]+)+$/i.test(s) && !/\s/.test(s) && !/^\d+$/.test(s);

const LEAD_FIELDS = [
    'name', 'category', 'address', 'city', 'phone', 'email', 'website', 'rating', 'reviewCount',
    'leadScore', ['leadScoreReason', { maxString: 200 }], ['websiteIssues', { maxArray: 3 }],
    'estimatedOpenDate', 'openedText', 'unclaimedListing', 'facebook', 'instagram', 'linkedin', 'tiktok', 'hoursToday', 'mapsUrl',
];
const DRAFT_FIELDS = [['emailTemplate', { maxString: 1500 }], ['linkedinMessage', { maxString: 600 }], ['smsTemplate', { maxString: 300 }]];

const leadFilters = {
    find_emails: z.boolean().default(true).describe('Visit each business website to find an email address. Slower, but most leads are useless without it.'),
    without_website_only: z.boolean().default(false).describe('Only businesses with no website (good prospects for web design and marketing services).'),
    with_website_only: z.boolean().default(false).describe('Only businesses that list a website.'),
    opened_within_days: z.number().int().min(0).max(365).default(0).describe('Only businesses that opened within this many days; 30, 60 or 90 work best. 0 means any age.'),
    min_reviews: z.number().int().min(0).optional().describe('Skip businesses with fewer reviews than this.'),
    max_reviews: z.number().int().min(0).optional().describe('Skip businesses with more reviews than this, e.g. 30 to find newer businesses.'),
    include_outreach_drafts: z.boolean().default(false).describe('Add AI-written cold email, LinkedIn and SMS drafts for each lead.'),
};
const leadFilterInput = (a) => ({
    scrapeEmails: a.find_emails,
    noWebsiteOnly: a.without_website_only,
    requireWebsite: a.with_website_only,
    dateRangeDays: a.opened_within_days,
    ...(a.min_reviews !== undefined && { minReviews: a.min_reviews }),
    ...(a.max_reviews !== undefined && { maxReviews: a.max_reviews }),
});

const TRENDS_TIME = {
    past_hour: 'now 1-H', past_4_hours: 'now 4-H', past_day: 'now 1-d', past_7_days: 'now 7-d', past_30_days: 'today 1-m',
    past_90_days: 'today 3-m', past_12_months: 'today 12-m', past_5_years: 'today 5-y', all_time: 'all',
};
const TRENDS_SEARCH = { web: '', images: 'images', news: 'news', youtube: 'youtube', shopping: 'froogle' };
const JOB_COUNTRIES = ['us', 'gb', 'ca', 'in', 'sg', 'za', 'ae', 'ph', 'my', 'ng', 'pk', 'hk', 'gh', 'qa', 'sa', 'eg', 'de', 'ch', 'es', 'mx', 'ar', 'co', 'pe', 'it', 'br', 'jp'];
const IMAGE_COLORS = ['any', 'color', 'black_and_white', 'transparent', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'white', 'gray', 'black', 'brown'];
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const appStore = (a) => {
    if (a.store !== 'auto') return a.store;
    return /play\.google\.com/i.test(a.app) || isPackageName(a.app) ? 'google_play' : 'app_store';
};

export const TOOLS = [
    {
        name: 'search_flights',
        title: 'Google Flights search',
        toolsets: ['travel'],
        slug: 'google-flights-scraper',
        cost: { unit: 0.0002 },
        description: `Search Google Flights for one route and date. Returns each flight's total price, airlines, flight numbers, departure and arrival times, duration, stops and layovers, CO2 emissions, and whether Google marks it as a best flight. One way by default; set return_date for round-trip prices. Use it for flight prices, schedules and the cheapest or fastest options between two places. Typically 5–20 seconds. Cost on your Apify account: ${price('google-flights-scraper')}.`,
        inputSchema: {
            origin: z.string().min(2).describe('Departure airport code (JFK) or city (New York).'),
            destination: z.string().min(2).describe('Arrival airport code (LHR) or city (London).'),
            departure_date: z.string().regex(ISO_DATE).optional().describe('Departure date, YYYY-MM-DD. If omitted, Google picks a date about two weeks out.'),
            return_date: z.string().regex(ISO_DATE).optional().describe('Return date, YYYY-MM-DD, for a round trip; prices are then round-trip totals.'),
            adults: z.number().int().min(1).max(9).default(1).describe('Adult passengers; prices are totals for all of them.'),
            cabin_class: z.enum(['economy', 'premium_economy', 'business', 'first']).default('economy').describe('Cabin class.'),
            stops: z.enum(['any', 'nonstop', 'one_stop_or_fewer']).default('any').describe('Limit the number of stops.'),
            currency: z.string().regex(/^[A-Za-z]{3}$/).default('USD').describe('Three-letter currency code for prices: USD, EUR, GBP, INR…'),
            country: country('Two-letter country code for the Google point of sale, e.g. us, gb, de. Prices can differ by country.'),
            max_results: maxResults(15, 50, 'flights'),
        },
        input: (a) => ({
            origin: a.origin,
            destination: a.destination,
            ...(a.departure_date && { departureDate: a.departure_date }),
            ...(a.return_date && { returnDate: a.return_date }),
            adults: a.adults,
            cabinClass: camel(a.cabin_class),
            stops: a.stops === 'one_stop_or_fewer' ? 'oneStop' : a.stops,
            currency: a.currency.toUpperCase(),
            country: a.country.toLowerCase(),
            maxFlightsPerSearch: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'price', 'currency', 'isBest', 'airlines', 'flightNumbers', 'from', 'fromAirport', 'to', 'toAirport', 'departure', 'arrival',
            'duration', 'stops', ['layovers', { maxArray: 4 }], 'emissionsKg', 'emissionsVsTypicalPercent', 'departureDate', 'returnDate', 'priceNote',
        ]),
        summary: (items, a) => `${items.length} flights ${a.origin} → ${a.destination}${items[0]?.departureDate ? ` departing ${items[0].departureDate}` : ''}${a.return_date ? `, returning ${a.return_date}` : ''}.${items[0]?.googleFlightsUrl ? ` Google Flights: ${items[0].googleFlightsUrl}` : ''}`,
    },
    {
        name: 'search_hotels',
        title: 'Google Hotels search',
        toolsets: ['travel'],
        slug: 'google-hotels-scraper',
        cost: { unit: 0.001 },
        description: `Search Google Hotels for a city, neighbourhood or landmark. Returns hotel name, star class, guest rating and review count, nightly price with and without taxes, estimated total for the stay, description, nearby places, website, coordinates and Google Hotels link. Set check_in and check_out for exact prices (otherwise Google picks dates). Filter by minimum rating, minimum stars and maximum nightly price. Up to 20 hotels per search, typically 5–20 seconds. Cost on your Apify account: ${price('google-hotels-scraper')}.`,
        inputSchema: {
            location: z.string().min(2).describe('Where to stay: a city (Paris), an area (Shoreditch London) or a full search (hotels near Times Square).'),
            check_in: z.string().regex(ISO_DATE).optional().describe('Check-in date, YYYY-MM-DD.'),
            check_out: z.string().regex(ISO_DATE).optional().describe('Check-out date, YYYY-MM-DD.'),
            adults: z.number().int().min(1).max(10).default(2).describe('Guests per room.'),
            min_rating: z.enum(['any', '3.5', '4', '4.5']).default('any').describe('Only hotels with at least this guest rating.'),
            min_stars: z.enum(['any', '2', '3', '4', '5']).default('any').describe('Only hotels with at least this many stars.'),
            max_price_per_night: z.number().int().positive().optional().describe("Only hotels at or under this nightly price, in the results' currency."),
            currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("Three-letter currency code (USD, EUR, GBP). Google may still answer in the country's currency."),
            country: country('Two-letter country code for Google, e.g. us, gb, de. It can change the currency and booking partners.'),
            max_results: maxResults(10, 20, 'hotels'),
        },
        input: (a) => ({
            locations: [a.location],
            ...(a.check_in && { checkIn: a.check_in }),
            ...(a.check_out && { checkOut: a.check_out }),
            adults: a.adults,
            minRating: a.min_rating === 'any' ? '0' : a.min_rating,
            minHotelClass: a.min_stars === 'any' ? '0' : a.min_stars,
            ...(a.max_price_per_night && { maxPricePerNight: a.max_price_per_night }),
            ...(a.currency && { currency: a.currency.toUpperCase() }),
            country: a.country.toLowerCase(),
            maxHotelsPerSearch: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'name', 'hotelClass', 'rating', 'reviewCount', 'pricePerNight', 'pricePerNightWithTaxes', 'estimatedStayTotal', 'currency',
            'checkIn', 'checkOut', 'nights', ['description', { maxString: 250 }], ['nearby', { maxArray: 3 }], 'website', 'googleHotelsUrl', 'latitude', 'longitude',
        ]),
        summary: (items, a) => `${items.length} hotels for "${a.location}"${items[0]?.checkIn ? `, ${items[0].checkIn} to ${items[0].checkOut}` : ''}.`,
    },
    {
        name: 'search_google_shopping',
        title: 'Google Shopping search',
        toolsets: ['shopping', 'google-search'],
        slug: 'google-shopping-scraper',
        cost: { unit: 0.001 },
        description: `Search Google Shopping for a product in any country. Returns product title, current price, original price and discount, store, whether other stores sell it, delivery and returns details, rating, review count and a Google Shopping link. Use it for price comparison, finding where to buy, and competitor or market price research. About 50 products per search in the country's currency, typically a few seconds. Cost on your Apify account: ${price('google-shopping-scraper')}.`,
        inputSchema: {
            query: z.string().min(1).describe('Product search as you would type it into Google Shopping, e.g. "wireless earbuds" or "iPhone 16 Pro 256GB".'),
            country: country("Two-letter country code; prices come in that country's currency, e.g. us, gb, de, in."),
            max_results: maxResults(20, 50, 'products'),
        },
        input: (a) => ({ queries: [a.query], country: a.country.toLowerCase(), maxResultsPerQuery: a.max_results }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'title', 'price', 'currency', 'oldPrice', 'discountPercent', 'store', 'moreStores', 'delivery', 'returns', 'rating', 'reviewCount', 'badges', 'googleShoppingUrl',
        ]),
        summary: (items, a) => `${items.length} Google Shopping results for "${a.query}" (${a.country.toUpperCase()}).`,
    },
    {
        name: 'get_youtube_transcripts',
        title: 'YouTube transcripts',
        toolsets: ['youtube'],
        slug: 'youtube-transcript-scraper',
        cost: { unit: 0.0015 },
        description: `Get the transcript (captions) of YouTube videos, with title, channel, duration, caption language and word count, and optional timestamps. Accepts video URLs or IDs, Shorts, youtu.be links, and channel or playlist URLs (it takes their latest videos). Manual captions in the requested language come first, then auto-generated ones; translation into another language is best effort. Use it to summarise, quote, fact-check or search inside videos. Videos without captions come back with an error status and aren't billed. Cost on your Apify account: ${price('youtube-transcript-scraper')}.`,
        inputSchema: {
            videos: z.array(z.string().min(5)).min(1).max(10).describe('YouTube video URLs or 11-character IDs, Shorts or youtu.be links, or channel/playlist URLs. Up to 10.'),
            language: z.string().min(2).max(10).default('en').describe('Preferred caption language code, e.g. en, es, de, fr, ja.'),
            translate_to: z.string().min(2).max(10).optional().describe('Optional language code to machine-translate the transcript into (best effort; YouTube rate-limits translation).'),
            include_timestamps: z.boolean().default(false).describe('Return the transcript as timestamped lines ("[1:23] text") instead of plain text.'),
            max_videos_per_channel: z.number().int().min(1).max(15).default(5).describe('For channel or playlist URLs: how many of the latest videos to take.'),
            max_characters: z.number().int().min(1000).max(200000).default(30000).describe('Cut each transcript after this many characters to protect your context window.'),
        },
        input: (a) => ({
            videos: a.videos,
            language: a.language,
            ...(a.translate_to && { translateTo: a.translate_to }),
            includeTimestamps: a.include_timestamps,
            includeAutoGenerated: true,
            maxVideosPerChannel: a.max_videos_per_channel,
        }),
        maxItems: (a) => Math.min(150, a.videos.length * a.max_videos_per_channel),
        format: (items, a) => items.map((v) => {
            const text = a.include_timestamps && Array.isArray(v.segments) && v.segments.length
                ? v.segments.map((s) => `[${formatSeconds(s.start)}] ${s.text}`).join('\n')
                : v.transcript;
            return compact({
                videoId: v.videoId, url: v.url, title: v.title, channel: v.channel, duration: v.duration, status: v.status, error: v.error,
                language: v.transcriptLanguage, isAutoGenerated: v.isAutoGenerated, isTranslated: v.isTranslated, translationNote: v.translationNote,
                wordCount: v.wordCount, availableLanguages: v.availableLanguages, transcript: truncate(text, a.max_characters),
            }, { maxString: a.max_characters + 1, maxArray: 40 });
        }),
        summary: (items) => `${items.filter((v) => v.transcript).length} of ${items.length} videos have a transcript.`,
    },
    {
        name: 'search_google_news',
        title: 'Google News search',
        toolsets: ['news', 'google-search'],
        slug: 'google-news-scraper',
        cost: { unit: 0.001 },
        description: `Search Google News for a topic, company or person. Returns headline, snippet, publisher, publish time and the publisher's article URL (Google's redirect is resolved). Filter by time (past hour to past year) and sort by relevance or newest first, in any country and language. Use it for current events, company and competitor news monitoring, and research. Up to 100 articles per call, typically a few seconds. Cost on your Apify account: ${price('google-news-scraper')}.`,
        inputSchema: {
            query: z.string().min(1).describe('News search, e.g. "Nvidia earnings" or "EV tariffs". Google operators work, e.g. site:reuters.com.'),
            time: z.enum(['any', 'hour', 'day', 'week', 'month', 'year']).default('any').describe('Only articles from the past hour, day, week, month or year.'),
            sort_by: z.enum(['relevance', 'date']).default('relevance').describe("Google's order, or newest first."),
            country: country(),
            language: language(),
            max_results: maxResults(20, 100, 'articles'),
        },
        input: (a) => ({
            queries: [a.query], time: a.time, sortBy: a.sort_by, country: a.country.toLowerCase(), language: a.language,
            maxResultsPerQuery: a.max_results, resolveArticleUrls: true,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, ['title', ['snippet', { maxString: 300 }], 'source', 'publishedAt', 'publishedText', 'url']),
        summary: (items, a) => `${items.length} Google News articles for "${a.query}"${a.time !== 'any' ? ` from the past ${a.time}` : ''}.`,
    },
    {
        name: 'search_google_images',
        title: 'Google Images search',
        toolsets: ['google-search'],
        slug: 'google-images-scraper',
        cost: { unit: 0.00025 },
        description: `Search Google Images. Returns the full-size image URL with width and height, a thumbnail, and the source page's URL, title and site. Filter by size, colour, type (photo, clipart, line art, face, animated), time and usage rights. Up to 100 images per search, typically a few seconds. Check the licence on the source page before reusing an image. Cost on your Apify account: ${price('google-images-scraper')}.`,
        inputSchema: {
            query: z.string().min(1).describe('Image search, e.g. "modern kitchen" or "golden retriever puppy".'),
            size: z.enum(['any', 'large', 'medium', 'icon']).default('any').describe('Image size.'),
            color: z.enum(IMAGE_COLORS).default('any').describe('Colour filter.'),
            image_type: z.enum(['any', 'photo', 'clipart', 'lineart', 'face', 'animated']).default('any').describe('Image type.'),
            time: z.enum(['any', 'day', 'week', 'month', 'year']).default('any').describe('Only images from the past day, week, month or year.'),
            license: z.enum(['any', 'creative_commons', 'commercial']).default('any').describe('Usage rights, as Google classifies them.'),
            country: country(),
            language: language(),
            max_results: maxResults(20, 100, 'images'),
        },
        input: (a) => ({
            queries: [a.query], size: a.size, color: camel(a.color), imageType: a.image_type, time: a.time, license: camel(a.license),
            country: a.country.toLowerCase(), language: a.language, maxResultsPerQuery: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, ['title', 'imageUrl', 'imageWidth', 'imageHeight', 'thumbnailUrl', 'pageUrl', 'source']),
        summary: (items, a) => `${items.length} Google Images results for "${a.query}".`,
    },
    {
        name: 'search_google_videos',
        title: 'Google Videos search',
        toolsets: ['google-search'],
        slug: 'google-videos-scraper',
        cost: { unit: 0.001 },
        description: `Search Google's video results across YouTube, TikTok, Vimeo, news sites and more. Returns title, URL, platform, channel, duration, publish date, snippet, key moments and a Shorts flag. Filter by time and length. Use it to find videos on a topic beyond YouTube's own search. Up to 100 videos per call. Cost on your Apify account: ${price('google-videos-scraper')}.`,
        inputSchema: {
            query: z.string().min(1).describe('Video search, e.g. "how to make sourdough bread".'),
            time: z.enum(['any', 'hour', 'day', 'week', 'month', 'year']).default('any').describe('Only videos from the past hour, day, week, month or year.'),
            duration: z.enum(['any', 'short', 'medium', 'long']).default('any').describe('Length: short is under 4 minutes, medium 4–20, long over 20.'),
            country: country(),
            language: language(),
            max_results: maxResults(20, 100, 'videos'),
        },
        input: (a) => ({
            queries: [a.query], time: a.time, duration: a.duration, country: a.country.toLowerCase(), language: a.language, maxResultsPerQuery: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'title', 'url', 'platform', 'channel', 'duration', 'publishedAt', 'publishedText', ['snippet', { maxString: 250 }], ['keyMoments', { maxArray: 5 }], 'isShort',
        ]),
        summary: (items, a) => `${items.length} Google video results for "${a.query}".`,
    },
    {
        name: 'search_jobs',
        title: 'Google Jobs search',
        toolsets: ['jobs'],
        slug: 'google-jobs-scraper',
        cost: { unit: 0.002, fixed: 0.03 },
        description: `Search Google Jobs, which aggregates listings from LinkedIn, Indeed, Glassdoor, company career sites and more, in 26 countries. Returns job title, company, location, remote flag, source, posting date, employment type, salary (text plus parsed min, max, currency and period), a description excerpt, qualifications and apply links. Filter by date posted, employment type and remote only. Up to 100 jobs per call. Cost on your Apify account: ${price('google-jobs-scraper')}.`,
        inputSchema: {
            query: z.string().min(1).describe('Job search, e.g. "software engineer", "registered nurse" or "marketing manager".'),
            location: z.string().optional().describe('City, region or area, e.g. "New York", "London" or "Austin, TX". Leave empty for the whole country.'),
            country: z.enum(JOB_COUNTRIES).default('us').describe('Country to search; Google Jobs is verified in these countries.'),
            date_posted: z.enum(['any', 'today', '3days', 'week', 'month']).default('any').describe('Only jobs posted since yesterday, in the last 3 days, week or month.'),
            employment_type: z.enum(['any', 'fulltime', 'parttime', 'contractor', 'internship']).default('any').describe('Only jobs of this type.'),
            remote_only: z.boolean().default(false).describe('Only remote or work-from-home jobs.'),
            max_results: maxResults(20, 100, 'jobs'),
        },
        input: (a) => ({
            queries: [a.query], ...(a.location && { location: a.location }), country: a.country, datePosted: a.date_posted,
            employmentType: a.employment_type, remoteOnly: a.remote_only, maxJobsPerQuery: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'title', 'companyName', 'location', 'isRemote', 'via', 'postedAt', 'postedAgo', 'employmentType', 'salaryText', 'salaryMin', 'salaryMax',
            'salaryCurrency', 'salaryPeriod', ['description', { maxString: 500 }], ['qualifications', { maxArray: 5, maxString: 200 }], 'applyUrl', 'jobUrl',
        ]),
        summary: (items, a) => `${items.length} jobs for "${a.query}"${a.location ? ` in ${a.location}` : ''} (${a.country.toUpperCase()}).`,
    },
    {
        name: 'get_google_trends',
        title: 'Google Trends',
        toolsets: ['trends'],
        slug: 'google-trends-scraper',
        cost: { unit: 0.001 },
        description: `Google Trends for up to 5 keywords: interest over time (0–100), average, latest and peak interest, trend direction and change, top regions, and top and rising related searches with "Breakout" flags. Compare terms on one scale and choose the country or region (US, GB, US-CA…), the time range (past hour to all time) and the search type (web, images, news, YouTube, Shopping). Use it for demand and seasonality research and to compare brands or topics. Cost on your Apify account: ${price('google-trends-scraper')}.`,
        inputSchema: {
            terms: z.array(z.string().min(1)).min(1).max(5).describe('Keywords or topics, up to 5, e.g. ["chatgpt", "gemini", "claude"].'),
            compare: z.boolean().default(true).describe('Put all terms on one 0–100 scale, like a Google Trends comparison.'),
            geo: z.string().max(10).default('').describe('Country or region code, e.g. US, GB, DE, US-CA (California), GB-ENG. Empty means worldwide.'),
            time_range: z.enum(Object.keys(TRENDS_TIME)).default('past_12_months').describe('Period to analyse.'),
            search_type: z.enum(Object.keys(TRENDS_SEARCH)).default('web').describe('Which Google search to measure interest in.'),
            include_regions: z.boolean().default(true).describe('Add the regions where each term is searched most.'),
            include_related_queries: z.boolean().default(true).describe('Add top and rising related searches.'),
        },
        input: (a) => ({
            searchTerms: a.terms,
            compareAll: a.compare && a.terms.length > 1,
            geo: a.geo.toUpperCase(),
            timeRange: TRENDS_TIME[a.time_range],
            searchType: TRENDS_SEARCH[a.search_type],
            includeInterestOverTime: true,
            includeInterestByRegion: a.include_regions,
            includeCities: false,
            includeRelatedQueries: a.include_related_queries,
            includeRelatedTopics: false,
        }),
        maxItems: (a) => a.terms.length,
        format: (items) => items.filter((r) => r.type === 'keyword-report').map((r) => compact({
            searchTerm: r.searchTerm, geo: r.geoName, timeRange: r.timeRangeLabel, comparedWith: r.comparedWith,
            averageInterest: r.averageInterest, latestInterest: r.latestInterest, peakInterest: r.peakInterest, peakDate: r.peakDate,
            lowestInterest: r.lowestInterest, changePercent: r.changePercent, trendDirection: r.trendDirection, summary: r.summary,
            timeline: downsample(r.timeline, 60)?.map((p) => ({ date: p.date, value: p.value, ...(p.isPartial && { partial: true }) })),
            regions: r.regions?.slice(0, 10).map((g) => ({ name: g.name, value: g.value })), topQueries: r.topQueries?.slice(0, 10),
            risingQueries: r.risingQueries?.slice(0, 10), notes: r.notes, trendsUrl: r.trendsUrl,
        }, { maxString: 400, maxArray: 60 })),
        summary: (items, a) => `Google Trends for ${a.terms.map((t) => `"${t}"`).join(', ')}${a.geo ? ` in ${a.geo.toUpperCase()}` : ' worldwide'}, ${a.time_range.replace(/_/g, ' ')}.`,
    },
    {
        name: 'get_trending_searches',
        title: 'Google trending searches now',
        toolsets: ['trends'],
        slug: 'google-trends-scraper',
        cost: { unit: 0.0005 },
        description: `What's trending on Google right now in a country, like trends.google.com/trending: each trending search with its search volume, increase, start time, whether it is still active, related searches and optional news articles. Windows of the past 4, 24 or 48 hours or 7 days. Use it for real-time monitoring, news-jacking and content ideas. Cost on your Apify account: ${price('google-trends-scraper')}.`,
        inputSchema: {
            country: z.string().regex(/^[A-Za-z]{2}$/).default('US').describe('Two-letter country code, e.g. US, GB, IN, DE.'),
            hours: z.number().int().min(1).max(168).default(24).describe('Time window in hours: 4, 24, 48 or 168 (7 days). Other values round to the nearest.'),
            include_news: z.boolean().default(false).describe('Add up to 3 news articles Google shows for each trending search.'),
            only_active: z.boolean().default(false).describe('Skip searches Google marks as no longer trending.'),
            max_results: maxResults(25, 100, 'trending searches'),
        },
        input: (a) => ({
            trendingGeos: [a.country.toUpperCase()],
            trendingHours: [4, 24, 48, 168].reduce((best, h) => (Math.abs(h - a.hours) < Math.abs(best - a.hours) ? h : best), 24),
            trendingMaxItems: a.max_results,
            includeNews: a.include_news,
            newsPerTrend: 3,
            onlyActiveTrends: a.only_active,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items.filter((r) => r.type === 'trending-search'), [
            'rank', 'title', 'searchVolumeLabel', 'increasePercent', 'startedAt', 'isActive', ['relatedQueries', { maxArray: 5 }], 'categories',
            ['newsArticles', { maxArray: 3, maxString: 200 }],
        ]),
        summary: (items, a) => `${items.length} trending searches in ${a.country.toUpperCase()}.`,
    },
    {
        name: 'find_local_businesses',
        title: 'Google Maps business leads',
        toolsets: ['leads'],
        slug: 'google-maps-leads',
        cost: { unit: 0.08 },
        description: `Find local businesses on Google Maps in any country, as sales leads. Returns name, category, address, phone, email (found on the business website), website, rating and review count, social profiles, opening-date estimate, unclaimed-listing flag and a lead score with reasons. Search any business type in any city, e.g. "dentist" in "Austin, TX". Filters for businesses without a website, recently opened businesses and review counts. Optional AI outreach drafts. About 1–3 minutes for 10 leads because it visits each website. Cost on your Apify account: ${price('google-maps-leads')}.`,
        inputSchema: {
            business_type: z.string().min(2).describe('What to search for on Google Maps, e.g. "dentist", "vegan restaurant" or "roofing contractor".'),
            location: z.string().min(2).describe('City or area, e.g. "Austin, TX" or "Berlin, Germany". Add the state or country when a name is ambiguous.'),
            country: country('Two-letter country code for the location, e.g. us, gb, ca, au, de.'),
            max_results: maxResults(10, 100, 'businesses'),
            ...leadFilters,
        },
        input: (a) => ({
            cities: [a.location], country: a.country.toLowerCase(), category: 'all', customSearchTerms: [a.business_type],
            maxResults: a.max_results, ...leadFilterInput(a),
        }),
        maxItems: (a) => a.max_results,
        format: (items, a) => shape(items, a.include_outreach_drafts ? [...LEAD_FIELDS, ...DRAFT_FIELDS] : LEAD_FIELDS),
        summary: (items, a) => `${items.length} ${a.business_type} leads in ${a.location}, ${items.filter((l) => l.email).length} with an email.`,
    },
    {
        name: 'find_uk_business_leads',
        title: 'UK business leads with directors',
        toolsets: ['leads'],
        slug: 'uk-business-leads',
        cost: { unit: 0.1 },
        description: `UK business leads from Google Maps, enriched from Companies House: everything find_local_businesses returns plus the company director's name, company number, incorporation date, company age and SIC codes, with a match-confidence rating. Search UK cities or postcodes for any business type. Use it for UK B2B prospecting. About 1–3 minutes for 10 leads. Cost on your Apify account: ${price('uk-business-leads')}.`,
        inputSchema: {
            business_type: z.string().min(2).describe('What to search for, e.g. "plumber", "dentist" or "coffee shop".'),
            cities: z.array(z.string().min(2)).max(10).optional().describe('UK cities, towns or regions, e.g. ["Manchester", "Leeds"]. Give cities or postcodes.'),
            postcodes: z.array(z.string().min(2)).max(20).optional().describe('UK postcodes or districts to search around, e.g. ["M1 1AA", "LS1"].'),
            radius_miles: z.number().int().min(1).max(50).default(5).describe('Search radius around each postcode: 1–5 for a neighbourhood, 10–20 for a town.'),
            max_results: maxResults(10, 100, 'businesses'),
            ...leadFilters,
            unclaimed_only: z.boolean().default(false).describe("Only businesses that haven't claimed their Google Business Profile."),
        },
        validate: (a) => (a.cities?.length || a.postcodes?.length ? null : 'Give at least one UK city or postcode.'),
        input: (a) => ({
            cities: a.cities ?? [], postcodes: a.postcodes ?? [], radiusMiles: a.radius_miles, category: 'all', customSearchTerms: [a.business_type],
            maxResults: a.max_results, requireUnclaimed: a.unclaimed_only, ...leadFilterInput(a),
        }),
        maxItems: (a) => a.max_results,
        format: (items, a) => shape(items, [
            ...LEAD_FIELDS, 'directorName', 'companyNumber', 'incorporationDate', 'companyAge', 'sicCodes', 'companyMatchConfidence',
            ...(a.include_outreach_drafts ? DRAFT_FIELDS : []),
        ]),
        summary: (items, a) => `${items.length} UK ${a.business_type} leads, ${items.filter((l) => l.directorName).length} with a director name and ${items.filter((l) => l.email).length} with an email.`,
    },
    {
        name: 'get_advertiser_ads',
        title: 'Google Ads Transparency lookup',
        toolsets: ['ads'],
        slug: 'google-ads-transparency-scraper',
        cost: { unit: 0.001 },
        description: `Every ad an advertiser runs on Google Search, YouTube, Display and Shopping, from Google's Ads Transparency Center. Returns format, first and last shown dates, days running, headline, ad texts, display URL, landing page, image URLs and YouTube video. Look up by advertiser name, website domain, Transparency Center URL or advertiser ID, and filter by country and format. Use it for competitor ad research and creative inspiration. Newest ads first, up to 200 per call. Cost on your Apify account: ${price('google-ads-transparency-scraper')}.`,
        inputSchema: {
            advertiser: z.string().min(2).describe('Advertiser name (Nike), website domain (nike.com), Ads Transparency Center URL or advertiser ID (AR…).'),
            region: z.string().default('anywhere').describe('Two-letter country code to see only ads shown there (us, gb, de…), or "anywhere".'),
            format: z.enum(['all', 'text', 'image', 'video']).default('all').describe('Only ads of this format.'),
            include_ad_content: z.boolean().default(true).describe("Open each ad's preview for its headline, texts, landing page, images and video. Slower but much more useful."),
            max_results: maxResults(40, 200, 'ads'),
        },
        input: (a) => ({
            advertisers: [a.advertiser], region: a.region, format: a.format, includeAdContent: a.include_ad_content, maxAdsPerAdvertiser: a.max_results,
        }),
        maxItems: (a) => a.max_results,
        format: (items) => shape(items, [
            'advertiserName', 'format', 'firstShown', 'lastShown', 'daysShown', 'headline', ['texts', { maxArray: 3 }], 'displayUrl', 'landingUrl',
            'youtubeUrl', ['imageUrls', { maxArray: 2 }], 'adUrl', 'region',
        ]),
        summary: (items, a) => `${items.length} ads by ${items[0]?.advertiserName ?? a.advertiser}${a.region !== 'anywhere' ? ` shown in ${a.region.toUpperCase()}` : ''}.`,
    },
    {
        name: 'get_app_reviews',
        title: 'App Store and Google Play reviews',
        toolsets: ['app-reviews'],
        slug: (a) => (appStore(a) === 'google_play' ? 'google-play-reviews-scraper' : 'app-store-reviews-scraper'),
        cost: { unit: 0.0001 },
        description: `App reviews from the Apple App Store or Google Play: star rating, title, text, date, reviewer, app version, helpful votes and the developer's reply. Accepts store URLs, App Store IDs, Google Play package names or app names. Filter by star rating (e.g. 1–2 stars for complaints), sort by newest or most relevant, in any country and language. Up to 500 reviews per call. Cost on your Apify account: ${price('app-store-reviews-scraper')}.`,
        inputSchema: {
            app: z.string().min(2).describe('App Store URL or numeric ID (324684580), Google Play URL or package name (com.spotify.music), or an app name (Spotify).'),
            store: z.enum(['auto', 'app_store', 'google_play']).default('auto').describe('Which store. auto reads it from the URL or ID; plain app names go to the App Store unless you choose google_play.'),
            max_reviews: z.number().int().min(1).max(500).default(50).describe('How many reviews to return, 1–500.'),
            sort: z.enum(['newest', 'relevant']).default('newest').describe('Newest first, or the store\'s "most relevant" order.'),
            country: country('Two-letter store country, e.g. us, gb, de. Reviews differ by country.'),
            language: language(),
            min_rating: z.number().int().min(1).max(5).default(1).describe('Only reviews with at least this many stars.'),
            max_rating: z.number().int().min(1).max(5).default(5).describe('Only reviews with at most this many stars, e.g. 2 for complaints.'),
        },
        input: (a) => {
            const common = {
                apps: [a.app], maxReviewsPerApp: a.max_reviews, sort: a.sort, language: a.language, minRating: a.min_rating, maxRating: a.max_rating, includeAppDetails: true,
            };
            return appStore(a) === 'google_play' ? { ...common, country: a.country.toLowerCase() } : { ...common, countries: [a.country.toLowerCase()] };
        },
        maxItems: (a) => a.max_reviews,
        format: (items) => shape(items, ['rating', 'title', ['text', { maxString: 600 }], 'date', 'userName', 'appVersion', 'thumbsUp', ['replyText', { maxString: 200 }]]),
        summary: (items, a) => {
            const app = items[0];
            const store = appStore(a) === 'google_play' ? 'Google Play' : 'App Store';
            return `${items.length} ${store} reviews for ${app?.appName ?? a.app}${app?.appRating ? ` (rated ${app.appRating} from ${app.appRatingsCount ?? '?'} ratings)` : ''}.`;
        },
    },
    {
        name: 'analyze_app_reviews',
        title: 'AI app review analysis',
        toolsets: ['app-reviews'],
        slug: 'app-store-review-miner',
        cost: { unit: 0.05 },
        description: `AI analysis of the latest App Store and Google Play reviews for up to 5 apps: top bugs, top feature requests, critical issues, competitor mentions, a sentiment summary, the rating distribution and the app versions mentioned. Accepts store URLs, App Store IDs, Google Play package names or app names. Use it for product research, competitor analysis and release monitoring. About 30–90 seconds per app. Cost on your Apify account: ${price('app-store-review-miner')}.`,
        inputSchema: {
            apps: z.array(z.string().min(2)).min(1).max(5).describe('Up to 5 apps: store URLs, App Store IDs, Google Play package names or plain app names (e.g. "Duolingo").'),
            max_reviews_per_app: z.number().int().min(10).max(500).default(100).describe('How many of the latest reviews to analyse per app and store.'),
            country: country('Two-letter store country, e.g. us, gb, de.'),
        },
        input: (a) => ({
            appUrls: a.apps.filter(isUrl),
            appleAppIds: a.apps.filter((s) => /^\d+$/.test(s)),
            googlePlayIds: a.apps.filter((s) => !isUrl(s) && isPackageName(s)),
            appNames: a.apps.filter((s) => !isUrl(s) && !/^\d+$/.test(s) && !isPackageName(s)),
            maxReviewsPerApp: a.max_reviews_per_app,
            appleCountry: a.country.toLowerCase(),
            googlePlayCountry: a.country.toLowerCase(),
            includeRawReviews: false,
        }),
        maxItems: (a) => a.apps.length * 2,
        format: (items) => shape(items, [
            'appName', 'platform', 'country', 'storeRating', 'storeRatingCount', 'avgRating', 'reviewCount', 'reviewDateRange', 'ratingDistribution',
            ['topBugsList', { maxArray: 8 }], ['topFeatureRequestsList', { maxArray: 8 }], ['criticalIssuesList', { maxArray: 5 }],
            ['competitorMentionsList', { maxArray: 5 }], ['sentimentSummary', { maxString: 600 }], 'versionsMentioned', 'aiStatus', 'message',
        ]),
        summary: (items) => `AI review analysis for ${items.length} app${items.length === 1 ? '' : 's'}: ${items.map((r) => `${r.appName} (${r.platform})`).join(', ')}.`,
    },
    {
        name: 'check_ai_overview_citations',
        title: 'Google AI Overview citation check',
        toolsets: ['ai-visibility'],
        slug: 'aeo-auditor',
        cost: { unit: 0.04, fixed: 2 },
        description: `Check Google AI Overviews for your keywords: whether an AI Overview appears, whether it cites your domain and at what position, which domains and competitors it cites instead, whether your brand is mentioned, the AI Overview text, your organic rank, and what changed since your last check. Use it for AEO and GEO (answer and generative engine optimisation) audits and monitoring. About 5–20 seconds per keyword. Cost on your Apify account: ${price('aeo-auditor')}.`,
        inputSchema: {
            queries: z.array(z.string().min(2)).min(1).max(20).describe('Searches to check, exactly as people type them, e.g. ["best crm for small business"].'),
            domain: z.string().min(3).describe('Your website, e.g. "yourbrand.com". Subdomains count.'),
            brand_names: z.array(z.string().min(1)).max(10).optional().describe('Names that count as a brand mention in the AI Overview text.'),
            competitor_domains: z.array(z.string().min(3)).max(20).optional().describe('Competitor websites to watch, e.g. ["hubspot.com", "pipedrive.com"].'),
            country: country(),
            language: language(),
        },
        input: (a) => ({
            queries: a.queries, targetDomain: a.domain, maxQueries: a.queries.length, country: a.country.toLowerCase(), language: a.language,
            brandNames: a.brand_names ?? [], competitorDomains: a.competitor_domains ?? [], generateReport: false,
        }),
        maxItems: (a) => a.queries.length,
        format: (items) => shape(items, [
            'query', 'status', 'aiOverviewPresent', 'targetDomainInAI', 'targetCitationPosition', ['citedDomains', { maxArray: 10 }], 'competitorsCited',
            'brandMentioned', 'brandsMentioned', ['aiOverviewText', { maxString: 700 }], 'organicRank', 'citationChange', 'previousCheckedAt',
        ]),
        summary: (items, a) => {
            const withAio = items.filter((r) => r.aiOverviewPresent).length;
            return `${a.domain} is cited in ${items.filter((r) => r.targetDomainInAI).length} of ${withAio} AI Overviews (${items.length} keywords checked).`;
        },
    },
    {
        name: 'check_ai_visibility',
        title: 'AI assistant brand visibility',
        toolsets: ['ai-visibility'],
        slug: 'ai-visibility-tracker',
        cost: { unit: 0.05 },
        description: `Ask AI assistants the questions your customers ask and see whether they mention and cite your brand. For each prompt and engine (Google AI Overviews, Gemini with Google Search, Claude with web search) it returns whether the brand is mentioned, its rank among the brands named, whether it is cited, competitors mentioned and cited, sentiment, the snippet about the brand and the sources cited. Use it for AI search visibility and share-of-voice tracking. Each prompt on each engine is one answer checked. Takes 1–3 minutes. Cost on your Apify account: ${price('ai-visibility-tracker')}.`,
        inputSchema: {
            brand: z.string().min(2).describe('Brand or product name as people write it, e.g. "Notion".'),
            domain: z.string().optional().describe('Your website, e.g. "notion.so", to check whether answers cite it.'),
            prompts: z.array(z.string().min(5)).min(1).max(25).describe('Questions people ask AI assistants in your market, e.g. "What is the best note-taking app for teams?".'),
            competitors: z.array(z.string().min(2)).max(25).optional().describe('Competitors as names, domains or "Name (domain.com)".'),
            engines: z.array(z.enum(['google-ai-overviews', 'gemini', 'claude'])).min(1).default(['google-ai-overviews', 'gemini', 'claude']).describe('AI engines to ask.'),
            country: country('Two-letter country code for localised answers, e.g. us, gb, de.'),
            create_report: z.boolean().default(false).describe('Also build a shareable HTML report (extra charge, see the price).'),
        },
        input: (a) => ({
            brand: a.brand, domain: a.domain ?? '', prompts: a.prompts, topics: [], competitors: a.competitors ?? [], maxPrompts: a.prompts.length,
            engines: a.engines, country: a.country.toLowerCase(), analyzeAnswers: true, generateReport: a.create_report,
        }),
        maxItems: (a) => a.prompts.length * a.engines.length,
        extraCost: (a) => (a.create_report ? 0.5 : 0),
        format: (items) => shape(items, [
            'prompt', 'engine', 'visibility', 'brandMentioned', 'brandRank', 'brandCited', 'brandCitationRank', ['competitorsMentioned', { maxArray: 10 }],
            ['competitorsCited', { maxArray: 10 }], 'sentiment', ['sentimentSummary', { maxString: 300 }], ['brandSnippet', { maxString: 300 }],
            ['citedDomains', { maxArray: 8 }], 'mentionChange', 'citationChange', ['answer', { maxString: 600 }],
        ]),
        summary: (items, a) => `${a.brand} is mentioned in ${items.filter((r) => r.brandMentioned).length} of ${items.length} AI answers and cited in ${items.filter((r) => r.brandCited).length}.`,
    },
];

export const TOOLSETS = {
    all: 'Every tool',
    travel: 'Google Flights and Google Hotels',
    shopping: 'Google Shopping',
    youtube: 'YouTube transcripts',
    news: 'Google News',
    'google-search': 'Google Shopping, News, Images and Videos',
    jobs: 'Google Jobs',
    trends: 'Google Trends and trending searches',
    leads: 'Google Maps business leads, worldwide and UK',
    ads: 'Google Ads Transparency',
    'app-reviews': 'App Store and Google Play reviews and AI analysis',
    'ai-visibility': 'Google AI Overview citations and AI assistant brand visibility',
};

/** "all", or a comma-separated mix of toolset names and tool names. */
export function selectTools(spec = 'all') {
    const wanted = String(spec || 'all').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!wanted.length || wanted.includes('all')) return TOOLS;
    const unknown = wanted.filter((w) => !TOOLSETS[w] && !TOOLS.some((t) => t.name === w));
    if (unknown.length) throw new Error(`Unknown toolset or tool: ${unknown.join(', ')}. Toolsets: ${Object.keys(TOOLSETS).join(', ')}.`);
    return TOOLS.filter((t) => wanted.includes(t.name) || t.toolsets.some((s) => wanted.includes(s)));
}

/** Spending cap passed to Apify for a call: roughly 3x the expected charge, at least $0.25. */
export function chargeCap(tool, args) {
    const expected = tool.cost.unit * tool.maxItems(args) + (tool.cost.fixed ?? 0) + (tool.extraCost?.(args) ?? 0);
    return Math.max(0.25, Math.ceil(expected * 3 * 100) / 100);
}

export const actorOf = (tool, args) => `automationnation/${typeof tool.slug === 'function' ? tool.slug(args) : tool.slug}`;
