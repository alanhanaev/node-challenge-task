import { z } from 'zod';

// Zod schema for Chain validation
export const chainSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  chainId: z.string().min(1).max(50),
  isEnabled: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Type derived from the schema
export type ChainData = z.infer<typeof chainSchema>;

// Helper function to validate chain data
export function validateChain(data: Partial<ChainData>): ChainData {
  return chainSchema.parse(data);
}

