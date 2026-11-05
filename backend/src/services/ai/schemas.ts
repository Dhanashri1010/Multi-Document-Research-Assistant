import { z } from 'zod';

/**
 * Zod schema for structured claim-level citation tracking.
 */
export const GroundedClaimSchema = z.object({
  claim: z.string(),
  sourceIndices: z.array(z.number()).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('high'),
});

/**
 * Zod schema for RAG answer generation with evidence validation.
 */
export const StructuredRAGAnswerSchema = z.object({
  hasInsufficientEvidence: z.boolean(),
  insufficientReason: z.string().optional(),
  answer: z.string(),
  claims: z.array(GroundedClaimSchema).default([]),
});

export type StructuredRAGAnswer = z.infer<typeof StructuredRAGAnswerSchema>;

/**
 * Zod schema for comparison matrix values.
 */
export const ComparisonValueSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  finding: z.string(),
  pageNumber: z.number().optional(),
  supportedByExcerpt: z.boolean().default(true),
});

/**
 * Zod schema for 8 academic comparison dimensions.
 */
export const ComparisonDimensionSchema = z.object({
  dimension: z.string(),
  values: z.array(ComparisonValueSchema),
});

/**
 * Zod schema for cross-document academic comparative synthesis.
 */
export const StructuredComparisonSchema = z.object({
  matrix: z.array(ComparisonDimensionSchema),
  similarities: z.array(z.string()).default([]),
  differences: z.array(z.string()).default([]),
  keyFindings: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
});

export type StructuredComparison = z.infer<typeof StructuredComparisonSchema>;
