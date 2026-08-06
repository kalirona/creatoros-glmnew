// ============================================================================
// Seed Enterprise AI Infrastructure
// ----------------------------------------------------------------------------
// Seeds the database with the providers, models, routes, and tools needed
// for the Phase AI-04 architecture. Idempotent — safe to run multiple times.
// ============================================================================

import { db } from '../src/lib/db'

const PROVIDERS = [
  {
    name: 'OpenRouter',
    slug: 'openrouter',
    capabilities: 'TEXT',
    description: 'Unified gateway to 100+ LLMs. Powers Writing, Marketing, Course, Website, SEO, Email, Blog, CRM, and Automation AI.',
    docsUrl: 'https://openrouter.ai/docs',
    priority: 10,
    dailyBudget: 50,
    monthlyBudget: 1000,
    isActive: true,
    models: [
      { name: 'deepseek/deepseek-chat', displayName: 'DeepSeek Chat', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.00014, outputCostPer1k: 0.00028 },
      { name: 'anthropic/claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet', modality: 'TEXT', inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
      { name: 'openai/gpt-4o', displayName: 'GPT-4o', modality: 'TEXT', inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
      { name: 'google/gemini-flash-1.5', displayName: 'Gemini Flash 1.5', modality: 'TEXT', inputCostPer1k: 0.000075, outputCostPer1k: 0.0003 },
    ],
  },
  {
    name: 'Fal AI',
    slug: 'fal-ai',
    capabilities: 'IMAGE,VIDEO',
    description: 'Serverless image & video generation. Powers Image Generator, Image Editing, Upscaling, Background Removal, Logo, Icon, Thumbnail, Video, Avatar.',
    docsUrl: 'https://fal.ai/docs',
    priority: 20,
    dailyBudget: 100,
    monthlyBudget: 2000,
    isActive: true,
    models: [
      { name: 'flux-pro', displayName: 'Flux Pro', modality: 'IMAGE', isDefault: true, inputCostPer1k: 0.05, outputCostPer1k: 0 },
      { name: 'flux-dev', displayName: 'Flux Dev', modality: 'IMAGE', inputCostPer1k: 0.03, outputCostPer1k: 0 },
      { name: 'kling-video', displayName: 'Kling Video', modality: 'VIDEO', isDefault: true, inputCostPer1k: 0.5, outputCostPer1k: 0 },
      { name: 'sdxl', displayName: 'SDXL', modality: 'IMAGE', inputCostPer1k: 0.02, outputCostPer1k: 0 },
    ],
  },
  {
    name: 'OpenAI',
    slug: 'openai',
    capabilities: 'TEXT,IMAGE,EMBEDDING',
    description: 'Direct OpenAI API. Powers Embeddings, Whisper transcription, and DALL·E image generation.',
    docsUrl: 'https://platform.openai.com/docs',
    priority: 30,
    dailyBudget: 30,
    monthlyBudget: 800,
    isActive: true,
    models: [
      { name: 'text-embedding-3-small', displayName: 'Embedding 3 Small', modality: 'EMBEDDING', isDefault: true, inputCostPer1k: 0.00002, outputCostPer1k: 0 },
      { name: 'gpt-4o-mini', displayName: 'GPT-4o Mini', modality: 'TEXT', inputCostPer1k: 0.00015, outputCostPer1k: 0.0006 },
    ],
  },
  {
    name: 'ElevenLabs',
    slug: 'elevenlabs',
    capabilities: 'TTS',
    description: 'Realistic AI voices and text-to-speech. Powers Voice AI, narration, and podcast generation.',
    docsUrl: 'https://elevenlabs.io/docs',
    priority: 40,
    dailyBudget: 20,
    monthlyBudget: 500,
    isActive: false,
    models: [
      { name: 'eleven-multilingual-v2', displayName: 'Multilingual v2', modality: 'TTS', isDefault: true, inputCostPer1k: 0.18, outputCostPer1k: 0 },
    ],
  },
  {
    name: 'Deepgram',
    slug: 'deepgram',
    capabilities: 'STT',
    description: 'Speech-to-text transcription. Powers audio transcription, subtitles, and meeting notes.',
    docsUrl: 'https://developers.deepgram.com/docs',
    priority: 50,
    dailyBudget: 15,
    monthlyBudget: 400,
    isActive: false,
    models: [
      { name: 'nova-2', displayName: 'Nova 2', modality: 'STT', isDefault: true, inputCostPer1k: 0.0043, outputCostPer1k: 0 },
    ],
  },
  {
    name: 'Anthropic',
    slug: 'anthropic',
    capabilities: 'TEXT',
    description: 'Direct Anthropic API. Powers high-quality writing and reasoning tasks.',
    docsUrl: 'https://docs.anthropic.com',
    priority: 60,
    dailyBudget: 40,
    monthlyBudget: 1000,
    isActive: false,
    models: [
      { name: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet (latest)', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    ],
  },
  {
    name: 'Google Gemini',
    slug: 'gemini',
    capabilities: 'TEXT,IMAGE',
    description: 'Google AI multimodal models. Powers text, vision, and image generation.',
    docsUrl: 'https://ai.google.dev/docs',
    priority: 70,
    dailyBudget: 30,
    monthlyBudget: 800,
    isActive: false,
    models: [
      { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.00125, outputCostPer1k: 0.005 },
    ],
  },
  {
    name: 'DeepSeek',
    slug: 'deepseek',
    capabilities: 'TEXT',
    description: 'Direct DeepSeek API. Cost-effective reasoning and code generation.',
    docsUrl: 'https://api-docs.deepseek.com',
    priority: 80,
    dailyBudget: 20,
    monthlyBudget: 500,
    isActive: false,
    models: [
      { name: 'deepseek-chat', displayName: 'DeepSeek Chat', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.00014, outputCostPer1k: 0.00028 },
    ],
  },
  {
    name: 'GLM (Z.ai)',
    slug: 'glm',
    capabilities: 'TEXT,IMAGE',
    description: 'Z.ai GLM models. Default fallback provider for text and image generation.',
    docsUrl: 'https://docs.z.ai',
    priority: 90,
    dailyBudget: 25,
    monthlyBudget: 700,
    isActive: true,
    models: [
      { name: 'glm-4-plus', displayName: 'GLM-4 Plus', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
      { name: 'cogview-3-plus', displayName: 'CogView 3 Plus', modality: 'IMAGE', isDefault: true, inputCostPer1k: 0.04, outputCostPer1k: 0 },
    ],
  },
  {
    name: 'Replicate',
    slug: 'replicate',
    capabilities: 'IMAGE,VIDEO',
    description: 'Run open-source models. Powers Stable Diffusion, Llama video, and specialized image models.',
    docsUrl: 'https://replicate.com/docs',
    priority: 100,
    dailyBudget: 25,
    monthlyBudget: 600,
    isActive: false,
    models: [
      { name: 'stability-ai/sdxl', displayName: 'SDXL', modality: 'IMAGE', isDefault: true, inputCostPer1k: 0.02, outputCostPer1k: 0 },
    ],
  },
  {
    name: 'Together AI',
    slug: 'together',
    capabilities: 'TEXT,IMAGE',
    description: 'Fast, cheap inference for open-source LLMs. Powers high-volume text generation.',
    docsUrl: 'https://docs.together.ai',
    priority: 110,
    dailyBudget: 20,
    monthlyBudget: 500,
    isActive: false,
    models: [
      { name: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', displayName: 'Llama 3.3 70B', modality: 'TEXT', isDefault: true, inputCostPer1k: 0.00088, outputCostPer1k: 0.00088 },
    ],
  },
  {
    name: 'RunPod',
    slug: 'runpod',
    capabilities: 'IMAGE,VIDEO',
    description: 'GPU serverless for custom models. Powers specialized image and video inference.',
    docsUrl: 'https://docs.runpod.io',
    priority: 120,
    dailyBudget: 30,
    monthlyBudget: 800,
    isActive: false,
    models: [],
  },
]

// Route rules — which provider powers which AI tool category
const ROUTES: { toolCategory: string; providerSlug: string; fallbackProviderSlug: string; strategy: string }[] = [
  { toolCategory: 'WRITING', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'MARKETING', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'COURSE', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'WEBSITE', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'SEO', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'EMAIL', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'BLOG', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'CRM', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'cost' },
  { toolCategory: 'AUTOMATION', providerSlug: 'openrouter', fallbackProviderSlug: 'glm', strategy: 'cost' },
  { toolCategory: 'IMAGE', providerSlug: 'fal-ai', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'VIDEO', providerSlug: 'fal-ai', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'VOICE', providerSlug: 'elevenlabs', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'STT', providerSlug: 'deepgram', fallbackProviderSlug: 'glm', strategy: 'smart' },
  { toolCategory: 'EMBEDDING', providerSlug: 'openai', fallbackProviderSlug: 'glm', strategy: 'smart' },
]

// Tool slug → route category (used to update existing AiTool records)
const TOOL_ROUTES: { slug: string; routeCategory: string }[] = [
  { slug: 'COURSE_GENERATOR', routeCategory: 'COURSE' },
  { slug: 'LESSON_WRITER', routeCategory: 'COURSE' },
  { slug: 'EMAIL_WRITER', routeCategory: 'EMAIL' },
  { slug: 'SALES_PAGE_GENERATOR', routeCategory: 'WEBSITE' },
  { slug: 'BLOG_WRITER', routeCategory: 'BLOG' },
  { slug: 'SOCIAL_MEDIA', routeCategory: 'MARKETING' },
  { slug: 'SCRIPT_WRITER', routeCategory: 'MARKETING' },
  { slug: 'PRODUCT_DESCRIPTION', routeCategory: 'MARKETING' },
  { slug: 'LANDING_PAGE_GENERATOR', routeCategory: 'WEBSITE' },
  { slug: 'SEO_OPTIMIZER', routeCategory: 'SEO' },
]

async function seed() {
  console.log('Seeding enterprise AI infrastructure...')

  // 1. Upsert providers + their models
  for (const p of PROVIDERS) {
    const provider = await db.aiProvider.upsert({
      where: { slug: p.slug },
      create: {
        name: p.name,
        slug: p.slug,
        capabilities: p.capabilities,
        description: p.description,
        docsUrl: p.docsUrl,
        priority: p.priority,
        dailyBudget: p.dailyBudget,
        monthlyBudget: p.monthlyBudget,
        isActive: p.isActive,
        isHealthy: true,
      },
      update: {
        capabilities: p.capabilities,
        description: p.description,
        docsUrl: p.docsUrl,
        priority: p.priority,
        dailyBudget: p.dailyBudget,
        monthlyBudget: p.monthlyBudget,
      },
    })

    for (const m of p.models) {
      await db.aiModel.upsert({
        where: { providerId_name: { providerId: provider.id, name: m.name } },
        create: {
          providerId: provider.id,
          name: m.name,
          displayName: m.displayName,
          modality: m.modality,
          isDefault: m.isDefault || false,
          inputCostPer1k: m.inputCostPer1k,
          outputCostPer1k: m.outputCostPer1k,
          isActive: true,
        },
        update: {
          displayName: m.displayName,
          modality: m.modality,
          inputCostPer1k: m.inputCostPer1k,
          outputCostPer1k: m.outputCostPer1k,
        },
      })
    }
    console.log(`  ✓ ${p.name} (${p.models.length} models)`)
  }

  // 2. Upsert routes
  for (const r of ROUTES) {
    const provider = await db.aiProvider.findUnique({ where: { slug: r.providerSlug } })
    const fallback = await db.aiProvider.findUnique({ where: { slug: r.fallbackProviderSlug } })
    if (!provider) continue
    await db.aiRoute.upsert({
      where: { toolCategory: r.toolCategory },
      create: {
        toolCategory: r.toolCategory,
        providerId: provider.id,
        fallbackProviderId: fallback?.id || null,
        strategy: r.strategy,
        isActive: true,
      },
      update: {
        providerId: provider.id,
        fallbackProviderId: fallback?.id || null,
        strategy: r.strategy,
        isActive: true,
      },
    })
    console.log(`  ✓ Route ${r.toolCategory} → ${r.providerSlug} (fallback: ${r.fallbackProviderSlug})`)
  }

  // 3. Update tool routeCategory
  for (const t of TOOL_ROUTES) {
    await db.aiTool.updateMany({ where: { slug: t.slug }, data: { routeCategory: t.routeCategory } })
  }

  // 4. Ensure IMAGE_GEN and VIDEO_GEN tools exist
  const imageTool = await db.aiTool.upsert({
    where: { slug: 'IMAGE_GEN' },
    create: {
      slug: 'IMAGE_GEN',
      name: 'Image Generator',
      description: 'Generate high-quality AI images with style and aspect ratio control',
      icon: 'ImageIcon',
      category: 'Image',
      routeCategory: 'IMAGE',
      creditCost: 3,
      temperature: 0.8,
      maxTokens: 1000,
      outputType: 'IMAGE',
      isVisible: true,
      systemPrompt: 'You are an AI image generator. Generate high-quality images based on the user\'s prompt and style preferences.',
    },
    update: { routeCategory: 'IMAGE', outputType: 'IMAGE' },
  })
  console.log(`  ✓ Tool ${imageTool.slug}`)

  const videoTool = await db.aiTool.upsert({
    where: { slug: 'VIDEO_GEN' },
    create: {
      slug: 'VIDEO_GEN',
      name: 'Video Generator',
      description: 'Generate AI videos with presets for social, demo, explainer, and more',
      icon: 'Video',
      category: 'Video',
      routeCategory: 'VIDEO',
      creditCost: 15,
      temperature: 0.7,
      maxTokens: 1000,
      outputType: 'VIDEO',
      isVisible: true,
      systemPrompt: 'You are an AI video generator. Generate videos based on the user\'s prompt and preset preferences.',
    },
    update: { routeCategory: 'VIDEO', outputType: 'VIDEO' },
  })
  console.log(`  ✓ Tool ${videoTool.slug}`)

  // 5. Seed default brand profile (for default workspace)
  await db.aiBrandProfile.upsert({
    where: { workspaceId: 'default' },
    create: {
      workspaceId: 'default',
      brandVoice: 'professional',
      tone: 'confident',
      language: 'en',
      primaryColor: '#10b981',
      secondaryColor: '#0ea5e9',
      defaultAspectRatio: '1:1',
      guidelines: 'Speak directly to the audience. Use clear, concise language. Avoid jargon.',
      targetAudience: 'Creators, entrepreneurs, and online educators',
    },
    update: {},
  })
  console.log('  ✓ Default brand profile')

  // 6. Seed default storage quota
  await db.aiStorage.upsert({
    where: { workspaceId: 'default' },
    create: { workspaceId: 'default', quotaBytes: 5_368_709_120 },
    update: {},
  })
  console.log('  ✓ Default storage quota')

  console.log('\n✅ Enterprise AI infrastructure seeded successfully')
  console.log(`   ${PROVIDERS.length} providers, ${PROVIDERS.reduce((s, p) => s + p.models.length, 0)} models, ${ROUTES.length} routes`)
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
