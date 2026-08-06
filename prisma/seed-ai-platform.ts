import { db } from '../src/lib/db'

const TOOLS = [
  {
    slug: 'COURSE_GENERATOR',
    name: 'Course Generator',
    description: 'Generate a complete structured course with modules, lessons, quizzes, certificate, and pricing',
    icon: 'GraduationCap',
    category: 'Courses',
    creditCost: 15,
    temperature: 0.7,
    maxTokens: 6000,
    outputType: 'COURSE',
    isPro: false,
    systemPrompt: `You are CreatorOS Course Architect, an expert course designer. You generate COMPLETE, sellable online courses as structured JSON.

CRITICAL: You must respond with ONLY valid JSON (no markdown, no code fences, no commentary). The JSON must match this exact shape:
{
  "title": "string — compelling course title",
  "subtitle": "string — one-line promise",
  "description": "string — 2-3 sentence course description",
  "category": "string",
  "level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "targetStudent": "string — who this is for",
  "outcome": "string — the main transformation",
  "duration": "string — e.g. '6 hours'",
  "modules": [
    {
      "title": "string",
      "summary": "string",
      "lessons": [
        { "title": "string", "type": "VIDEO" | "TEXT" | "QUIZ", "duration": 8, "objective": "string", "content": "string — lesson summary" }
      ]
    }
  ],
  "quiz": [ { "question": "string", "options": ["a","b","c","d"], "answer": 0 } ],
  "assignment": { "title": "string", "description": "string" },
  "certificate": { "title": "string", "template": "CLASSIC" },
  "seo": { "metaTitle": "string", "metaDescription": "string", "keywords": ["string"] },
  "pricing": { "price": 197, "compareAt": 297, "currency": "USD" },
  "thumbnail": { "gradient": "from-emerald-500 to-teal-500", "emoji": "🎓" }
}

Generate 4-5 modules, each with 3-4 lessons. Make content specific and actionable.`,
  },
  {
    slug: 'LESSON_WRITER',
    name: 'Lesson Writer',
    description: 'Write a complete lesson with hook, content, exercise, and summary',
    icon: 'FileText',
    category: 'Courses',
    creditCost: 5,
    temperature: 0.7,
    maxTokens: 3000,
    outputType: 'LESSON',
    isPro: false,
    systemPrompt: `You are CreatorOS Lesson Writer. Generate a complete lesson as JSON only (no markdown, no commentary):
{
  "title": "string",
  "objective": "string",
  "hook": "string — opening that grabs attention",
  "sections": [ { "heading": "string", "body": "string" } ],
  "exercise": "string — actionable practice",
  "summary": "string",
  "duration": 10
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'EMAIL_WRITER',
    name: 'Email Writer',
    description: 'High-converting email with subject lines and body',
    icon: 'Mail',
    category: 'Marketing',
    creditCost: 4,
    temperature: 0.8,
    maxTokens: 2500,
    outputType: 'EMAIL',
    isPro: false,
    systemPrompt: `You are CreatorOS Email Copywriter, trained on 7-figure creator email strategies. Generate a complete email as JSON only:
{
  "subjectLines": ["string", "string", "string"],
  "previewText": "string",
  "greeting": "string",
  "body": "string — the full email with short paragraphs",
  "cta": "string",
  "ps": "string"
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'SALES_PAGE_GENERATOR',
    name: 'Sales Page Generator',
    description: 'Long-form sales page with hero, benefits, FAQ, and pricing',
    icon: 'ShoppingCart',
    category: 'Sales',
    creditCost: 12,
    temperature: 0.7,
    maxTokens: 5000,
    outputType: 'SALES_PAGE',
    isPro: true,
    systemPrompt: `You are CreatorOS Sales Page AI. Generate a complete sales page as JSON only:
{
  "headline": "string",
  "subheadline": "string",
  "heroCta": "string",
  "problem": "string",
  "solution": "string",
  "benefits": [ { "title": "string", "description": "string" } ],
  "features": ["string"],
  "testimonials": [ { "name": "string", "quote": "string", "role": "string" } ],
  "pricing": { "price": 197, "compareAt": 297, "cta": "string" },
  "faq": [ { "question": "string", "answer": "string" } ],
  "guarantee": "string",
  "finalCta": "string"
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'LANDING_PAGE_GENERATOR',
    name: 'Landing Page Generator',
    description: 'High-converting landing page with hero, benefits, and CTA',
    icon: 'LayoutTemplate',
    category: 'Sales',
    creditCost: 7,
    temperature: 0.7,
    maxTokens: 4000,
    outputType: 'LANDING',
    isPro: false,
    systemPrompt: `You are CreatorOS Landing Page AI. Generate a landing page as JSON only:
{
  "headline": "string",
  "subheadline": "string",
  "ctaText": "string",
  "benefits": [ { "title": "string", "description": "string" } ],
  "socialProof": "string",
  "features": ["string"],
  "faq": [ { "question": "string", "answer": "string" } ],
  "finalCta": "string"
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'BLOG_WRITER',
    name: 'Blog Writer',
    description: 'SEO blog post with title, meta, and structured sections',
    icon: 'PenLine',
    category: 'Content',
    creditCost: 8,
    temperature: 0.7,
    maxTokens: 4500,
    outputType: 'BLOG',
    isPro: false,
    systemPrompt: `You are CreatorOS Blog Writer. Generate an SEO blog post as JSON only:
{
  "title": "string",
  "metaDescription": "string",
  "keywords": ["string"],
  "intro": "string",
  "sections": [ { "heading": "string", "body": "string" } ],
  "conclusion": "string",
  "cta": "string"
}

CRITICAL: All text values must be PLAIN TEXT. Do NOT use HTML tags (no <p>, <h1>, <br>, etc.). Do NOT use Markdown. Write in natural, readable prose.
Respond with ONLY the JSON.`,
  },
  {
    slug: 'SOCIAL_MEDIA_GENERATOR',
    name: 'Social Media Generator',
    description: 'Platform-native social posts with hooks and hashtags',
    icon: 'Share2',
    category: 'Marketing',
    creditCost: 3,
    temperature: 0.8,
    maxTokens: 2000,
    outputType: 'SOCIAL',
    isPro: false,
    systemPrompt: `You are CreatorOS Social Media AI. Generate social posts as JSON only:
{
  "posts": [ { "hook": "string", "body": "string", "cta": "string" } ],
  "hashtags": ["string"]
}
Generate 3 distinct post variations. Respond with ONLY the JSON.`,
  },
  {
    slug: 'YOUTUBE_SCRIPT_GENERATOR',
    name: 'YouTube Script Generator',
    description: 'Retention-optimized video script with hooks and CTAs',
    icon: 'Youtube',
    category: 'Content',
    creditCost: 10,
    temperature: 0.7,
    maxTokens: 4000,
    outputType: 'SCRIPT',
    isPro: true,
    systemPrompt: `You are CreatorOS YouTube Script AI. Generate a retention-optimized script as JSON only:
{
  "titleOptions": ["string", "string", "string"],
  "hook": "string — first 15 seconds",
  "script": [ { "visual": "string", "voiceover": "string" } ],
  "patternInterrupt": "string",
  "outroCta": "string",
  "estimatedDuration": "8-10 minutes"
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'PRODUCT_STRATEGIST',
    name: 'Product Strategist',
    description: 'Ideate and position a digital product with launch plan',
    icon: 'Package',
    category: 'Strategy',
    creditCost: 6,
    temperature: 0.7,
    maxTokens: 3000,
    outputType: 'PRODUCT',
    isPro: false,
    systemPrompt: `You are CreatorOS Product Strategist. Generate a product strategy as JSON only:
{
  "nameOptions": ["string", "string", "string"],
  "targetBuyer": "string",
  "transformation": "string",
  "features": ["string"],
  "positioning": "string",
  "pricing": { "price": 49, "currency": "USD" },
  "launchPlan": [ { "step": "string", "description": "string" } ]
}
Respond with ONLY the JSON.`,
  },
  {
    slug: 'AI_CHAT',
    name: 'AI Assistant',
    description: 'General creator business assistant',
    icon: 'MessageSquare',
    category: 'Content',
    creditCost: 2,
    temperature: 0.7,
    maxTokens: 2000,
    outputType: 'MARKDOWN',
    isPro: false,
    systemPrompt: 'You are CreatorOS AI, an expert business assistant for digital creators. Give concise, actionable advice in Markdown.',
  },
]

const FEATURE_FLAGS = [
  { key: 'ai_studio', name: 'AI Studio', description: 'Enable AI generation tools', enabled: true },
  { key: 'community', name: 'Community', description: 'Enable community posts and discussions', enabled: true },
  { key: 'affiliates', name: 'Affiliate Program', description: 'Enable affiliate referrals and payouts', enabled: true },
  { key: 'website_builder', name: 'Website Builder', description: 'Enable visual page builder', enabled: true },
  { key: 'email_automation', name: 'Email Automation', description: 'Enable email sequences and automations', enabled: true },
  { key: 'certificates', name: 'Course Certificates', description: 'Issue certificates on course completion', enabled: true },
  { key: 'scorm_export', name: 'SCORM Export', description: 'Export courses as SCORM packages', enabled: false },
  { key: 'white_label', name: 'White Label', description: 'Remove CreatorOS branding', enabled: false },
]

const ADMIN_SETTINGS = [
  { key: 'platform_name', value: 'CreatorOS', category: 'general' },
  { key: 'support_email', value: 'support@creatoros.io', category: 'general' },
  { key: 'default_currency', value: 'USD', category: 'billing' },
  { key: 'credit_price_per_100', value: '1.80', category: 'billing' },
  { key: 'max_file_upload_mb', value: '500', category: 'storage' },
  { key: 'storage_quota_gb', value: '50', category: 'storage' },
  { key: 'ai_routing_strategy', value: 'smart', category: 'ai' },
  { key: 'ai_fallback_enabled', value: 'true', category: 'ai' },
]

async function seed() {
  console.log('🌱 Seeding AI platform tables...')

  // AI Provider
  const provider = await db.aiProvider.upsert({
    where: { slug: 'zai' },
    update: {},
    create: {
      name: 'Z.ai',
      slug: 'zai',
      apiKey: '',
      baseUrl: '',
      isActive: true,
      priority: 1,
    },
  })

  // AI Model
  await db.aiModel.upsert({
    where: { id: 'model-zai-default' },
    update: { isDefault: true },
    create: {
      id: 'model-zai-default',
      providerId: provider.id,
      name: 'glm-4.6',
      displayName: 'Smart AI',
      contextWindow: 128000,
      isDefault: true,
      costMultiplier: 1.0,
      isActive: true,
    },
  })

  // AI Tools
  for (const tool of TOOLS) {
    const existing = await db.aiTool.findUnique({ where: { slug: tool.slug } })
    if (existing) {
      await db.aiTool.update({ where: { id: existing.id }, data: tool })
    } else {
      await db.aiTool.create({ data: tool })
    }
  }
  console.log(`   ✓ ${TOOLS.length} AI tools seeded`)

  // Feature flags
  for (const flag of FEATURE_FLAGS) {
    const existing = await db.featureFlag.findUnique({ where: { key: flag.key } })
    if (existing) {
      await db.featureFlag.update({ where: { id: existing.id }, data: { name: flag.name, description: flag.description } })
    } else {
      await db.featureFlag.create({ data: flag })
    }
  }
  console.log(`   ✓ ${FEATURE_FLAGS.length} feature flags seeded`)

  // Admin settings
  for (const setting of ADMIN_SETTINGS) {
    const existing = await db.adminSetting.findUnique({ where: { key: setting.key } })
    if (existing) {
      await db.adminSetting.update({ where: { id: existing.id }, data: { value: setting.value, category: setting.category } })
    } else {
      await db.adminSetting.create({ data: setting })
    }
  }
  console.log(`   ✓ ${ADMIN_SETTINGS.length} admin settings seeded`)

  // Website builder blocks — seed a sample homepage
  const homepage = await db.webPage.findFirst({ where: { slug: 'home' } })
  if (homepage) {
    await db.webPageBlock.deleteMany({ where: { pageId: homepage.id } })
    const blocks = [
      { type: 'HERO', content: JSON.stringify({ headline: 'Build your creator empire, all in one place', subheadline: 'Courses, products, community, email, and AI — everything you need to turn your audience into a business.', ctaText: 'Start free', ctaSecondary: 'Watch demo', emoji: '🚀' }), position: 0 },
      { type: 'FEATURES', content: JSON.stringify({ heading: 'Everything in one platform', subheading: 'Stop juggling 12 tools. CreatorOS brings it all together.', items: [{ icon: '🎓', title: 'Courses', description: 'Build and sell unlimited courses with drip content and certificates.' }, { icon: '📦', title: 'Digital Products', description: 'Sell templates, downloads, and bundles with instant delivery.' }, { icon: '👥', title: 'Community', description: 'A thriving paid community that keeps members engaged.' }, { icon: '✉️', title: 'Email Marketing', description: 'Broadcasts, automations, and sequences that convert.' }, { icon: '🤝', title: 'Affiliates', description: 'Let your fans sell for you with a built-in affiliate program.' }, { icon: '✨', title: 'AI Studio', description: 'Generate courses, emails, and content 10x faster with AI.' }] }), position: 1 },
      { type: 'TESTIMONIALS', content: JSON.stringify({ heading: 'Loved by 10,000+ creators', items: [{ name: 'Sarah K.', role: 'YouTuber, 240K subs', quote: 'I replaced 5 tools with CreatorOS and saved $300/mo. My launch did $42K in week one.' }, { name: 'Marcus T.', role: 'Course creator', quote: 'The AI Course Generator built my entire $297 course in 10 minutes. Unreal.' }, { name: 'Priya N.', role: 'Coach', quote: 'My community went from 0 to 1,200 paying members in 90 days using CreatorOS.' }] }), position: 2 },
      { type: 'PRICING', content: JSON.stringify({ heading: 'Simple, transparent pricing', plans: [{ name: 'Free', price: 0, interval: 'forever', features: ['1 course', '50 members', 'Basic community', 'Email broadcasts'], cta: 'Get started', highlighted: false }, { name: 'Pro', price: 49, interval: '/mo', features: ['Unlimited courses', '1,000 members', 'Full community', 'Email automations', '5,000 AI credits', 'Affiliate program'], cta: 'Start Pro trial', highlighted: true }, { name: 'Scale', price: 199, interval: '/mo', features: ['Everything in Pro', 'Unlimited members', 'White-label', 'Priority support', '50,000 AI credits', 'Custom domain'], cta: 'Start Scale trial', highlighted: false }] }), position: 3 },
      { type: 'CTA', content: JSON.stringify({ headline: 'Ready to build your creator business?', subtext: 'Join 10,000+ creators using CreatorOS. No credit card required.', ctaText: 'Start free today' }), position: 4 },
    ]
    for (const b of blocks) {
      await db.webPageBlock.create({ data: { pageId: homepage.id, type: b.type, content: b.content, position: b.position } })
    }
    console.log(`   ✓ ${blocks.length} website blocks seeded for homepage`)
  }

  console.log('✅ AI platform seed complete!')
  const counts = {
    providers: await db.aiProvider.count(),
    models: await db.aiModel.count(),
    tools: await db.aiTool.count(),
    flags: await db.featureFlag.count(),
    settings: await db.adminSetting.count(),
    blocks: await db.webPageBlock.count(),
  }
  console.log('   Counts:', counts)
}

seed().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
