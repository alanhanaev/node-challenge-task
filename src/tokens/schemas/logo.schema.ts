import { z } from 'zod';

// Zod schema for Logo validation
export const logoSchema = z.object({
  id: z.string().uuid().optional(),
  bigPath: z.string().min(1).max(500),
  smallPath: z.string().min(1).max(500),
  thumbPath: z.string().min(1).max(500),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Type derived from the schema
export type LogoData = z.infer<typeof logoSchema>;

// Helper function to validate logo data
export function validateLogo(data: Partial<LogoData>): LogoData {
  return logoSchema.parse(data);
}

