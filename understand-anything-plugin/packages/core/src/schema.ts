import { z } from "zod";

// Edge types (18 values across 5 categories)
export const EdgeTypeSchema = z.enum([
  "imports", "exports", "contains", "inherits", "implements",  // Structural
  "calls", "subscribes", "publishes", "middleware",             // Behavioral
  "reads_from", "writes_to", "transforms", "validates",        // Data flow
  "depends_on", "tested_by", "configures",                     // Dependencies
  "related", "similar_to",                                      // Semantic
]);

// Aliases that LLMs commonly generate instead of canonical node types
export const NODE_TYPE_ALIASES: Record<string, string> = {
  func: "function",
  fn: "function",
  method: "function",
  interface: "class",
  struct: "class",
  mod: "module",
  pkg: "module",
  package: "module",
};

// Aliases that LLMs commonly generate instead of canonical edge types
export const EDGE_TYPE_ALIASES: Record<string, string> = {
  extends: "inherits",
  invokes: "calls",
  invoke: "calls",
  uses: "depends_on",
  requires: "depends_on",
  relates_to: "related",
  related_to: "related",
  similar: "similar_to",
  import: "imports",
  export: "exports",
  contain: "contains",
  publish: "publishes",
  subscribe: "subscribes",
};

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["file", "function", "class", "module", "concept"]),
  name: z.string(),
  filePath: z.string().optional(),
  lineRange: z.tuple([z.number(), z.number()]).optional(),
  summary: z.string(),
  tags: z.array(z.string()),
  complexity: z.enum(["simple", "moderate", "complex"]),
  languageNotes: z.string().optional(),
});

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: EdgeTypeSchema,
  direction: z.enum(["forward", "backward", "bidirectional"]),
  description: z.string().optional(),
  weight: z.number().min(0).max(1),
});

export const LayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodeIds: z.array(z.string()),
});

export const TourStepSchema = z.object({
  order: z.number(),
  title: z.string(),
  description: z.string(),
  nodeIds: z.array(z.string()),
  languageLesson: z.string().optional(),
});

export const ProjectMetaSchema = z.object({
  name: z.string(),
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  description: z.string(),
  analyzedAt: z.string(),
  gitCommitHash: z.string(),
});

export const KnowledgeGraphSchema = z.object({
  version: z.string(),
  project: ProjectMetaSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  layers: z.array(LayerSchema),
  tour: z.array(TourStepSchema),
});

export interface ValidationResult {
  success: boolean;
  data?: z.infer<typeof KnowledgeGraphSchema>;
  errors?: string[];
}

export function normalizeGraph(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;

  const d = data as Record<string, unknown>;
  const result = { ...d };

  if (Array.isArray(d.nodes)) {
    result.nodes = (d.nodes as any[]).map((node) => {
      if (
        typeof node === "object" &&
        node !== null &&
        typeof node.type === "string" &&
        node.type in NODE_TYPE_ALIASES
      ) {
        return { ...node, type: NODE_TYPE_ALIASES[node.type] };
      }
      return node;
    });
  }

  if (Array.isArray(d.edges)) {
    result.edges = (d.edges as any[]).map((edge) => {
      if (
        typeof edge === "object" &&
        edge !== null &&
        typeof edge.type === "string" &&
        edge.type in EDGE_TYPE_ALIASES
      ) {
        return { ...edge, type: EDGE_TYPE_ALIASES[edge.type] };
      }
      return edge;
    });
  }

  return result;
}

export function validateGraph(data: unknown): ValidationResult {
  const result = KnowledgeGraphSchema.safeParse(normalizeGraph(data));

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}
