import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import User from "./user.model.js";
import PasswordResetToken from "./password-reset-token.model.js";
import { sendPasswordResetEmail } from "../../services/email.service.js";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

const frontendUrl = process.env.FRONTEND_URL;

if (!frontendUrl) {
  throw new Error("FRONTEND_URL is not configured");
}

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
      new: true,
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
      new: true,
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
