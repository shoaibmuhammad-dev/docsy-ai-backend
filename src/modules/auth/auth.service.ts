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
import PasswordResetToken from "./password-reset-token.model.js";
import { randomBytes, createHash } from "node:crypto";
import { sendPasswordResetEmail } from "../../services/email.service.js";

const SALT_ROUNDS = 12;

// Compared against when the email doesn't exist, so login takes roughly the
// same time whether or not the account exists (prevents user enumeration).
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", SALT_ROUNDS);

const TOKEN_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

const frontendUrl = process.env.FRONTEND_URL;

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

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();

  const user = await User.findOne({ email }).select("_id email");

  // Do not reveal whether an account exists.
  if (!user) return;

  // 32 random bytes = 256 bits of entropy.
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  // Replaces any previous reset token for this user.
  await PasswordResetToken.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        tokenHash,
        expiresAt,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const resetUrl = new URL("/reset-password", frontendUrl);

  resetUrl.searchParams.set("token", token);

  try {
    await sendPasswordResetEmail(user.email, resetUrl.toString());
  } catch (error) {
    // Do not log the token, reset URL, or email address.
    console.error("Password reset email could not be sent.");

    // Remove the token created for this request so a failed
    // delivery does not leave an unusable reset link active.
    await PasswordResetToken.deleteOne({
      userId: user._id,
      tokenHash,
    });

    throw error;
  }
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Atomically consumes the token. Concurrent requests cannot
  // both successfully consume the same reset token.
  const resetRecord = await PasswordResetToken.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: now },
  });

  if (!resetRecord) {
    throw new Error("INVALID_OR_EXPIRED_RESET_TOKEN");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const updatedUser = await User.findByIdAndUpdate(
    resetRecord.userId,
    {
      $set: {
        password: passwordHash,
        passwordChangedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!updatedUser) {
    throw new Error("INVALID_OR_EXPIRED_RESET_TOKEN");
  }

  // Delete any other reset records for this user.
  await PasswordResetToken.deleteMany({
    userId: resetRecord.userId,
  });
}
