// ============================================================================
// N8N Integration — Workflow Registry
// ----------------------------------------------------------------------------
// Central registry of n8n workflows. Phase 1 only defines the health-test
// workflow. Future AI workflows are listed but disabled (enabled: false).
//
// DO NOT implement AI workflows here yet — that's Phase 2+.
// ============================================================================

import type { WorkflowDef } from './types'

/**
 * Registry of all n8n workflows CreatorOS can call.
 *
 * Phase 1: Only HEALTH_TEST is enabled. It's a simple ping/echo workflow
 * that verifies the n8n integration is working end-to-end.
 *
 * Phase 2+ (not yet active): AI workflows will be enabled here when migrated.
 * They are listed now for documentation, but `enabled: false` prevents calls.
 */
export const WORKFLOWS: Record<string, WorkflowDef> = {
  // ── Phase 1: Test workflow ──────────────────────────────────────────────
  HEALTH_TEST: {
    name: 'HEALTH_TEST',
    webhookId: 'creatoros-health-test',
    description: 'Simple health-check workflow. Receives authenticated request, echoes back success. Does NOT call any AI provider.',
    enabled: true,
    timeoutMs: 10_000,
    responseType: 'json',
  },

  // ── Phase 2.3 — Text generation (ACTIVE) ──────────────────────────────
  // Routes chat requests to OpenRouter via n8n. The feature flag
  // (N8N_AI_ENABLED env + n8n_ai_enabled DB flag) gates whether
  // engine.ts actually calls this workflow.
  TEXT_GENERATION: {
    name: 'TEXT_GENERATION',
    webhookId: 'text-generation',
    description: 'Text generation workflow. Routes chat requests to OpenRouter with the EXACT model specified by CreatorOS. Returns { text, provider, model } for model verification. Phase 2.3 — enabled for OpenRouter text generation.',
    enabled: true,
    timeoutMs: 60_000,
    responseType: 'json',
  },

  // ── Phase 3+ (future — NOT enabled yet) ─────────────────────────────────
  // These are placeholders for documentation. They cannot be called until
  // explicitly enabled in a future phase.
  IMAGE_GENERATION: {
    name: 'IMAGE_GENERATION',
    webhookId: 'image-generation',
    description: '[NOT YET MIGRATED] Image generation workflow. Will replace generateImage() adapter calls in Phase 3.',
    enabled: false,
    timeoutMs: 90_000,
    responseType: 'json',
  },
  VIDEO_GENERATION: {
    name: 'VIDEO_GENERATION',
    webhookId: 'video-generation',
    description: '[NOT YET MIGRATED] Video generation workflow. Will replace submitVideoJob() adapter calls in Phase 2.',
    enabled: false,
    timeoutMs: 120_000,
    responseType: 'json',
  },
  COURSE_GENERATION: {
    name: 'COURSE_GENERATION',
    webhookId: 'course-generation',
    description: '[NOT YET MIGRATED] Course outline generation workflow.',
    enabled: false,
    timeoutMs: 90_000,
    responseType: 'json',
  },
  CONTENT_GENERATION: {
    name: 'CONTENT_GENERATION',
    webhookId: 'content-generation',
    description: '[NOT YET MIGRATED] Generic content generation (blog, email, social, sales page).',
    enabled: false,
    timeoutMs: 60_000,
    responseType: 'json',
  },
}

/**
 * Get a workflow definition by its internal name.
 * Returns undefined if not found.
 */
export function getWorkflow(name: string): WorkflowDef | undefined {
  return WORKFLOWS[name]
}

/**
 * Get a workflow or throw a clear error if it doesn't exist.
 */
export function requireWorkflow(name: string): WorkflowDef {
  const wf = WORKFLOWS[name]
  if (!wf) {
    throw new Error(`Unknown n8n workflow: ${name}. Available: ${Object.keys(WORKFLOWS).join(', ')}`)
  }
  return wf
}

/**
 * Check if a workflow is enabled (exists + enabled=true).
 */
export function isWorkflowEnabled(name: string): boolean {
  const wf = WORKFLOWS[name]
  return !!wf && wf.enabled
}

/**
 * List all workflows (for admin display).
 */
export function listWorkflows(): WorkflowDef[] {
  return Object.values(WORKFLOWS)
}
