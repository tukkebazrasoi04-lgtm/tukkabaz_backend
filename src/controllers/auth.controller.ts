import { type NextFunction, type Request, type Response } from "express";
import { authService } from "../services/auth.service";
import {
  firebaseAuthSchema,
  loginSchema,
  logoutSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  emailVerificationRequestSchema,
  emailVerifySchema,
  phoneVerificationRequestSchema,
  phoneVerificationVerifySchema,
  registerSchema,
  refreshTokenSchema,
  userOtpRequestSchema,
  userOtpVerifySchema
} from "../validators/auth.validator";
import { AppError } from "../middleware/error.middleware";
import { sendSuccess } from "../utils/api-response";

export const firebaseAuthController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = firebaseAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.authenticateWithFirebase(parsed.data.idToken, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.registerWithPassword(parsed.data, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response, 201);
  } catch (error) {
    next(error);
  }
};

export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.loginWithPassword(parsed.data.email, parsed.data.password, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestPasswordResetController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid password reset body", parsed.error.flatten());
    }

    const response = await authService.requestPasswordReset(parsed.data.email);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = passwordResetVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid password reset body", parsed.error.flatten());
    }

    const response = await authService.resetPassword(parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const deleteAccountController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const response = await authService.deleteAccount(req.user.userId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestEmailVerificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = emailVerificationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid email verification body", parsed.error.flatten());
    }

    const response = await authService.requestEmailVerification(parsed.data.email);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const verifyEmailController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = emailVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid email verification body", parsed.error.flatten());
    }

    const response = await authService.verifyEmail(parsed.data, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestUserOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = userOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid OTP request body", parsed.error.flatten());
    }

    const response = await authService.requestUserOtp(parsed.data);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const verifyUserOtpController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = userOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid OTP body", parsed.error.flatten());
    }

    const response = await authService.verifyUserOtp(parsed.data, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const requestPhoneVerificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = phoneVerificationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid phone verification body", parsed.error.flatten());
    }

    const response = await authService.requestPhoneVerification(req.user.userId, parsed.data.phone);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const verifyPhoneVerificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = phoneVerificationVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid phone verification body", parsed.error.flatten());
    }

    const response = await authService.verifyPhoneVerification(req.user.userId, parsed.data.phone, parsed.data.otp);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const savePhoneController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = phoneVerificationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid phone body", parsed.error.flatten());
    }

    const response = await authService.savePhone(req.user.userId, parsed.data.phone);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const refreshTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.refreshTokens(parsed.data.refreshToken, {
      userAgent: req.get("user-agent") || undefined,
      ipAddress: req.ip
    });

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const getMeController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const response = await authService.getMe(req.user.userId);
    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsed = logoutSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "Invalid request body", parsed.error.flatten());
    }

    const response = await authService.logout(
      req.user.userId,
      req.user.sessionId,
      parsed.data.refreshToken
    );

    sendSuccess(res, response);
  } catch (error) {
    next(error);
  }
};
