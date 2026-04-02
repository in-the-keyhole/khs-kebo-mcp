export type BudgetTier = 'startup' | 'smb' | 'enterprise';
export type EngagementType = 'greenfield' | 'migration' | 'support' | 'augmentation';

export interface StructuredSummary {
  industry: string;
  tech_stack: string[];
  budget_tier: BudgetTier;
  cloud_providers: string[];
  engagement_type: EngagementType;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export interface StoredDocument {
  id: string;
  driveFileId: string;
  title: string;
  mimeType: string;
  contentRedacted: string;
  tags: string[] | null;
  createdAt: Date | null;
}

export interface EmbedResult {
  documentId: string;
  embeddingId: string;
  modelName: string;
  dimensions: number;
  structuredSummary: StructuredSummary;
}

export interface InsightResult {
  industries: Record<string, number>;
  techStack: Record<string, number>;
  budgetTiers: Record<BudgetTier, number>;
  cloudProviders: Record<string, number>;
  engagementTypes: Record<EngagementType, number>;
  documentCount: number;
  similarityThreshold: number;
}
