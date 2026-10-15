import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import User, { type IUser } from "./user.model.js";
import ApiError from "../../utils/ApiError.js";
import type {
  LoginInput,
  SignupInput,
} from "../../validators/auth.validator.js";
import { env } from "../../config/env.js";

const SALT_ROUNDS = 12;

// Compared against when the email doesn't exist, so login takes roughly the
// same time whether or not the account exists (prevents user enumeration).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", SALT_ROUNDS);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

const toPublicUser = (user: HydratedDocument<IUser>): PublicUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

const signToken = (userId: string): string =>
  jwt.sign({ id: userId }, env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === 11000;

export const signup = async ({
  name,
  email,
  password,
}: SignupInput): Promise<AuthResult> => {
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw new ApiError("An account with this email already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await User.create({ name, email, password: hashedPassword });
    return { user: toPublicUser(user), token: signToken(user._id.toString()) };
  } catch (error) {
    // Two simultaneous signups can both pass the exists() check
    if (isDuplicateKeyError(error)) {
      throw new ApiError("An account with this email already exists", 409);
    }
    throw error;
  }
};

export const login = async ({
  email,
  password,
}: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email }).select("+password");

  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_HASH,
  );

  if (!user || !isPasswordValid) {
    // Same message for both cases on purpose
    throw new ApiError("Invalid email or password", 401);
  }

  return { user: toPublicUser(user), token: signToken(user._id.toString()) };
};
