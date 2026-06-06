import bcrypt from "bcryptjs";
import { OtpPurpose, type User } from "@prisma/client";
import { firebaseAuth } from "../lib/firebase";
import {
  getRefreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/error.middleware";
import { env } from "../config/env";
import { normalizePhone, otpService } from "./otp.service";
import { logger } from "../utils/logger";

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

const userSelect = {
  id: true,
  firebaseUid: true,
  email: true,
  name: true,
  picture: true,
  phone: true,
  phoneVerifiedAt: true,
  deliveryAddress: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  deliveryPartner: {
    select: {
      id: true,
      name: true,
      phone: true,
      vehicleType: true,
      isAvailable: true,
      profileStatus: true,
      profilePhotoUrl: true,
      dlUrl: true,
      pushToken: true
    }
  }
} as const;

const getDefaultName = (email: string): string => email.split("@")[0];
const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const PASSWORD_RESET_PURPOSE = "PASSWORD_RESET" as OtpPurpose;

class AuthService {
  private async createTokensForSession(user: User, sessionId: string): Promise<AuthTokens> {
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
      sessionId
    });

    return { accessToken, refreshToken };
  }

  private async issueSessionForUser(user: User, meta: SessionMeta): Promise<AuthTokens> {
    const refreshExpiryDate = getRefreshExpiryDate();

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "PENDING",
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: refreshExpiryDate
      }
    });

    const { accessToken, refreshToken } = await this.createTokensForSession(user, session.id);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash, expiresAt: refreshExpiryDate }
    });

    return { accessToken, refreshToken };
  }

  async ensureDefaultAdmin(email: string, password: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const firebaseUid = `admin:${normalizedEmail}`;

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          firebaseUid,
          email: normalizedEmail,
          name: "Admin",
          role: "ADMIN",
          passwordHash
        }
      });
      return;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        passwordHash,
        ...(existing.firebaseUid ? {} : { firebaseUid })
      }
    });
  }

  async authenticateWithFirebase(idToken: string, meta: SessionMeta) {
    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(idToken);
    } catch (error: any) {
      logger.error("Firebase token verification failed", { error });
      throw new AppError(401, `Firebase token verification failed: ${error.message || "Invalid token"}`);
    }
    const firebaseUid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    const emailVerified = decoded.email_verified;
    const name = decoded.name?.trim();
    const picture = decoded.picture ?? null;

    if (!email) {
      throw new AppError(401, "Email is missing in Firebase token");
    }

    if (!emailVerified) {
      throw new AppError(401, "Email is not verified");
    }

    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });
    const userByEmail = user ? null : await prisma.user.findUnique({
      where: { email }
    });

    // Strict account separation: a delivery-partner email cannot sign in as a customer.
    if ((user ?? userByEmail)?.role === "DELIVERY") {
      throw new AppError(
        403,
        "This email is registered as a delivery partner. Please use a different email to continue as a customer."
      );
    }

    if (!user) {
      if (userByEmail) {
        user = await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            firebaseUid,
            name: name || userByEmail.name,
            picture
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            firebaseUid,
            email,
            name: name || getDefaultName(email),
            picture
          }
        });
      }
    } else {
      const shouldUpdateName = Boolean(name && name !== user.name);
      const shouldUpdatePicture = picture !== user.picture;
      const shouldUpdateEmail = email !== user.email;

      if (shouldUpdateName || shouldUpdatePicture || shouldUpdateEmail) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(shouldUpdateName ? { name } : {}),
            ...(shouldUpdatePicture ? { picture } : {}),
            ...(shouldUpdateEmail ? { email } : {})
          }
        });
      }
    }

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);

    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "Login successful",
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  async registerWithPassword(input: { name: string; email: string; password: string }, meta: SessionMeta) {
    const normalizedEmail = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      const hasPassword = Boolean(existing.passwordHash);
      throw new AppError(
        409,
        hasPassword
          ? "An account with this email already exists. Please sign in instead."
          : "This email is already linked with Google login. Please continue with Google."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        firebaseUid: `local:${normalizedEmail}`,
        email: normalizedEmail,
        name: input.name.trim(),
        passwordHash
      }
    });

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "Registration successful",
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  async loginWithPassword(email: string, password: string, meta: SessionMeta) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError(401, "Invalid email or password");
    }

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "Login successful",
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new AppError(404, "No account exists with this email.");
    }

    if (!user.passwordHash) {
      throw new AppError(400, "This email uses Google login. Please continue with Google.");
    }

    return otpService.requestOtp(normalizedEmail, PASSWORD_RESET_PURPOSE, "password reset");
  }

  async resetPassword(input: { email: string; otp: string; password: string }) {
    const normalizedEmail = normalizeEmail(input.email);
    await otpService.verifyOtp(normalizedEmail, PASSWORD_RESET_PURPOSE, input.otp);
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.passwordHash) {
      throw new AppError(400, "Password reset is not available for this account.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      prisma.session.updateMany({
        where: { userId: user.id },
        data: { revoked: true }
      })
    ]);

    return { message: "Password updated. Please sign in with your new password." };
  }

  async requestUserOtp(input: { name?: string; phone: string }) {
    const phone = normalizePhone(input.phone);
    return otpService.requestOtp(phone, OtpPurpose.USER_PHONE_LOGIN, "user login");
  }

  async verifyUserOtp(input: { name?: string; phone: string; otp: string }, meta: SessionMeta) {
    const phone = await otpService.verifyOtp(input.phone, OtpPurpose.USER_PHONE_LOGIN, input.otp);
    const existing = await prisma.user.findUnique({ where: { phone } });
    const defaultName = input.name?.trim() || `User ${phone.slice(-4)}`;

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            phoneVerifiedAt: new Date(),
            ...(input.name?.trim() ? { name: input.name.trim() } : {})
          }
        })
      : await prisma.user.create({
          data: {
            firebaseUid: `phone:${phone}`,
            email: `${phone.replace(/\D/g, "")}@phone.tukkebaz.local`,
            name: defaultName,
            phone,
            phoneVerifiedAt: new Date()
          }
        });

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);
    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "OTP login successful",
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  async requestPhoneVerification(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    const existing = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: userId }
      }
    });

    if (existing) {
      throw new AppError(409, "This phone number is already linked to another account.");
    }

    return otpService.requestOtp(normalizedPhone, OtpPurpose.USER_PHONE_VERIFY, "phone verification");
  }

  async verifyPhoneVerification(userId: string, phone: string, otp: string) {
    const normalizedPhone = await otpService.verifyOtp(phone, OtpPurpose.USER_PHONE_VERIFY, otp);
    const existing = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: userId }
      }
    });

    if (existing) {
      throw new AppError(409, "This phone number is already linked to another account.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date()
      },
      select: userSelect
    });

    return { message: "Phone verified", user };
  }

  async savePhone(userId: string, phone: string) {
    const normalizedPhone = normalizePhone(phone);
    if (env.KITCHEN_PHONE_NUMBER && normalizePhone(env.KITCHEN_PHONE_NUMBER) === normalizedPhone) {
      throw new AppError(409, "This phone number is reserved for kitchen operations.");
    }

    const existing = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        id: { not: userId }
      }
    });

    if (existing) {
      throw new AppError(409, "This phone number is already linked to another account.");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date()
      },
      select: userSelect
    });

    return { message: "Phone saved", user };
  }

  async loginAdminWithPassword(email: string, password: string, meta: SessionMeta) {
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        role: "ADMIN"
      }
    });

    if (!user || !user.passwordHash) {
      throw new AppError(401, "Invalid admin credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError(401, "Invalid admin credentials");
    }

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);

    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "Admin login successful",
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  async refreshTokens(refreshToken: string, meta: SessionMeta) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "Invalid or expired refresh token");
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId }
    });

    if (!session || session.userId !== payload.userId) {
      throw new AppError(401, "Session not found");
    }

    if (session.revoked) {
      throw new AppError(401, "Session is revoked");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, "Session has expired");
    }

    const isRefreshTokenValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);

    if (!isRefreshTokenValid) {
      throw new AppError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const nextRefreshExpiry = getRefreshExpiryDate();
    const nextAccessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id
    });
    const nextRefreshToken = signRefreshToken({
      userId: user.id,
      sessionId: session.id
    });
    const nextRefreshHash = await bcrypt.hash(nextRefreshToken, 10);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: nextRefreshHash,
        expiresAt: nextRefreshExpiry,
        userAgent: meta.userAgent ?? session.userAgent,
        ipAddress: meta.ipAddress ?? session.ipAddress
      }
    });

    return {
      message: "Token refreshed successfully",
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return { user };
  }

  async logout(userId: string, currentSessionId?: string, refreshToken?: string) {
    let sessionId = currentSessionId;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        if (payload.userId !== userId) {
          throw new AppError(401, "Refresh token does not belong to this user");
        }
        sessionId = payload.sessionId;
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(401, "Invalid refresh token");
      }
    }

    if (!sessionId) {
      throw new AppError(400, "No session found for logout");
    }

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      throw new AppError(404, "Session not found");
    }

    if (!session.revoked) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revoked: true }
      });
    }

    return { message: "Logged out successfully" };
  }

  async authenticatePartnerWithFirebase(idToken: string, meta: SessionMeta) {
    let decoded;
    try {
      decoded = await firebaseAuth.verifyIdToken(idToken);
    } catch (error: any) {
      logger.error("Firebase token verification failed", { error });
      throw new AppError(401, `Firebase token verification failed: ${error.message || "Invalid token"}`);
    }
    const firebaseUid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    const emailVerified = decoded.email_verified;
    const name = decoded.name?.trim();
    const picture = decoded.picture ?? null;

    if (!email) {
      throw new AppError(401, "Email is missing in Firebase token");
    }

    if (!emailVerified) {
      throw new AppError(401, "Email is not verified");
    }

    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });
    const userByEmail = user ? null : await prisma.user.findUnique({
      where: { email }
    });

    // Strict account separation: an existing customer/admin email cannot be turned
    // into a delivery partner. Only brand-new emails or existing partners may proceed.
    const existingAccount = user ?? userByEmail;
    if (existingAccount && existingAccount.role !== "DELIVERY") {
      throw new AppError(
        403,
        "This email is already registered as a customer account. Please use a different email to sign up as a delivery partner."
      );
    }

    if (!user) {
      if (userByEmail) {
        user = await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            firebaseUid,
            name: name || userByEmail.name,
            picture,
            role: "DELIVERY"
          }
        });
      } else {
        user = await prisma.user.create({
          data: {
            firebaseUid,
            email,
            name: name || getDefaultName(email),
            picture,
            role: "DELIVERY"
          }
        });
      }
    } else {
      const shouldUpdateRole = user.role !== "ADMIN" && user.role !== "DELIVERY";
      const shouldUpdateName = Boolean(name && name !== user.name);
      const shouldUpdatePicture = picture !== user.picture;
      const shouldUpdateEmail = email !== user.email;

      if (shouldUpdateRole || shouldUpdateName || shouldUpdatePicture || shouldUpdateEmail) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(shouldUpdateRole ? { role: "DELIVERY" } : {}),
            ...(shouldUpdateName ? { name } : {}),
            ...(shouldUpdatePicture ? { picture } : {}),
            ...(shouldUpdateEmail ? { email } : {})
          }
        });
      }
    }

    let partner = await prisma.deliveryPartner.findUnique({
      where: { userId: user.id }
    });

    if (!partner) {
      partner = await prisma.deliveryPartner.findUnique({
        where: { email }
      });

      if (partner) {
        partner = await prisma.deliveryPartner.update({
          where: { id: partner.id },
          data: { userId: user.id }
        });
      } else {
        partner = await prisma.deliveryPartner.create({
          data: {
            userId: user.id,
            email: user.email,
            name: user.name,
            phone: null,
            vehicleType: "Bike / Scooty",
            profileStatus: "INCOMPLETE"
          }
        });
      }
    }

    const { accessToken, refreshToken } = await this.issueSessionForUser(user, meta);

    const safeUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect
    });

    if (!safeUser) {
      throw new AppError(404, "User not found");
    }

    return {
      message: "Login successful",
      user: safeUser,
      partner,
      accessToken,
      refreshToken
    };
  }
}

export const authService = new AuthService();
