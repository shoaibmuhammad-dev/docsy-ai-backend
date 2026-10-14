import { z } from "zod";

const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Invalid email address");

// bcrypt only uses the first 72 bytes, so cap the length
const passwordField = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

// sign up schema validation
export const signupSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  email: emailField,
  password: passwordField,
});

// login schema validation
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
