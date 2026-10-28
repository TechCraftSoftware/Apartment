import { readDatabase, withDatabaseTransaction } from '@/server/db/database';
import { requireRealtorAdmin } from './authService';
import type { RealtorClientConfig } from '@/types';

export function getRealtorClientConfig(): RealtorClientConfig {
  const db = readDatabase();
  return db.realtorConfig;
}

export function updateRealtorClientConfig(
  actorUserId: string | undefined,
  updates: Partial<RealtorClientConfig>
):
  | { ok: true; config: RealtorClientConfig; message: string }
  | { ok: false; error: string; status: 400 | 401 | 403 } {
  const auth = requireRealtorAdmin(actorUserId);
  if (!auth.ok) {
    return auth;
  }

  return withDatabaseTransaction((db) => {
    const nowIso = new Date().toISOString();
    const current = db.realtorConfig;

    const depositPercentage =
      updates.depositPercentage !== undefined
        ? Math.min(90, Math.max(10, Number(updates.depositPercentage)))
        : current.depositPercentage;

    const verificationCodeExpiryMinutes =
      updates.verificationCodeExpiryMinutes !== undefined
        ? Math.min(10080, Math.max(5, Number(updates.verificationCodeExpiryMinutes)))
        : current.verificationCodeExpiryMinutes;

    const updated: RealtorClientConfig = {
      ...current,
      businessName: updates.businessName?.trim() || current.businessName,
      tagline: updates.tagline?.trim() || current.tagline,
      domain: updates.domain?.trim() || current.domain,
      primaryColor: updates.primaryColor?.trim() || current.primaryColor,
      contactEmail: updates.contactEmail?.trim() || current.contactEmail,
      contactPhone: updates.contactPhone?.trim() || current.contactPhone,
      whatsappNumber: updates.whatsappNumber?.trim() || current.whatsappNumber,
      officeAddress: updates.officeAddress?.trim() || current.officeAddress,
      paymentPolicy: updates.paymentPolicy || current.paymentPolicy,
      depositPercentage,
      verificationCodeExpiryMinutes,
      verificationMaxAttempts:
        updates.verificationMaxAttempts !== undefined
          ? Math.min(15, Math.max(3, Number(updates.verificationMaxAttempts)))
          : current.verificationMaxAttempts,
      bookingHoldMinutes:
        updates.bookingHoldMinutes !== undefined
          ? Math.max(15, Number(updates.bookingHoldMinutes))
          : current.bookingHoldMinutes,
      defaultCheckInTime: updates.defaultCheckInTime?.trim() || current.defaultCheckInTime,
      defaultCheckOutTime: updates.defaultCheckOutTime?.trim() || current.defaultCheckOutTime,
      cancellationPolicySummary:
        updates.cancellationPolicySummary?.trim() || current.cancellationPolicySummary,
      defaultCheckInInstructions:
        updates.defaultCheckInInstructions?.trim() || current.defaultCheckInInstructions,
      bankTransferBeneficiaryName:
        updates.bankTransferBeneficiaryName?.trim() || current.bankTransferBeneficiaryName,
      bankTransferBankName:
        updates.bankTransferBankName?.trim() || current.bankTransferBankName,
      bankTransferAccountNumber:
        updates.bankTransferAccountNumber?.trim() || current.bankTransferAccountNumber,
      bankTransferInstructions:
        updates.bankTransferInstructions?.trim() || current.bankTransferInstructions,
      updatedAt: nowIso,
    };

    db.realtorConfig = updated;

    db.auditLogs.unshift({
      id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      clientId: updated.clientId,
      actorUserId: auth.actor.id,
      actorEmail: auth.actor.email,
      actorRole: auth.actor.role,
      action: 'UPDATE_REALTOR_CLIENT_CONFIG',
      targetType: 'REALTOR_CONFIG',
      targetId: updated.clientId,
      metadataJson: JSON.stringify({
        businessName: updated.businessName,
        paymentPolicy: updated.paymentPolicy,
        depositPercentage: updated.depositPercentage,
        verificationCodeExpiryMinutes: updated.verificationCodeExpiryMinutes,
      }),
      createdAt: nowIso,
    });

    return {
      ok: true as const,
      config: updated,
      message: 'Realtor client configuration and booking policies updated.',
    };
  });
}
