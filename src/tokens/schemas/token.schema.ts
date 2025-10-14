import { z } from 'zod';

// Zod schema for token validation
export const tokenSchema = z.object({
  id: z.string().uuid().optional(),
  address: z.instanceof(Buffer),
  symbol: z.string().min(1).max(20).nullable().optional(),
  name: z.string().min(1).max(100).nullable().optional(),
  decimals: z.number().int().min(0).max(32767).default(0),
  isNative: z.boolean().default(false),
  isProtected: z.boolean().default(false),
  priority: z.number().int().default(0),

  // Foreign Keys
  chainId: z.string().uuid(),
  logoId: z.string().uuid().nullable().optional(),

  // Price
  price: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/)
    .default('0'),
  lastPriceUpdate: z.date().default(() => new Date()),

  // Timestamps
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Type derived from the schema
export type TokenData = z.infer<typeof tokenSchema>;

// Helper function to validate token data
export function validateToken(data: Partial<TokenData>): TokenData {
  return tokenSchema.parse(data);
}

// Helper function to validate partial token data (for updates)
export function validatePartialToken(
  data: Partial<TokenData>,
): Partial<TokenData> {
  return tokenSchema.partial().parse(data);
}
