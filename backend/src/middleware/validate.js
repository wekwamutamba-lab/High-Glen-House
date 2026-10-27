import { z } from "zod";

export function validate(schema) {
  return (req, res, next) => {
    try {
      const data = {
        ...(req.body || {}),
        ...(req.query || {}),
        ...(req.params || {}),
      };

      schema.parse(data);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: err.errors[0]?.message || "Invalid input",
        });
      }
      next(err);
    }
  };
}

export const uuidParam = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

export const paginationQuery = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0, "Page must be positive"),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .refine((val) => val > 0 && val <= 100, "Limit must be between 1 and 100"),
});