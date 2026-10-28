'use client';

import React, { useState } from 'react';
import {
  Building2,
  CreditCard,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Landmark,
} from 'lucide-react';
import { useBookingContext } from '@/context/BookingContext';
import { PaymentPolicyType } from '@/types';

export default function AdminRealtorSettingsPage() {
  const { realtorConfig, updateRealtorConfig } = useBookingContext();

  const [businessName, setBusinessName] = useState(realtorConfig.businessName);
  const [tagline, setTagline] = useState(realtorConfig.tagline);
  const [domain, setDomain] = useState(realtorConfig.domain);
  const [contactEmail, setContactEmail] = useState(realtorConfig.contactEmail);
  const [contactPhone, setContactPhone] = useState(realtorConfig.contactPhone);
  const [whatsappNumber, setWhatsappNumber] = useState(
    realtorConfig.whatsappNumber
  );
  const [officeAddress, setOfficeAddress] = useState(
    realtorConfig.officeAddress
  );
  const [paymentPolicy, setPaymentPolicy] = useState<PaymentPolicyType>(
    realtorConfig.paymentPolicy
  );
  const [depositPercentage, setDepositPercentage] = useState(
    realtorConfig.depositPercentage
  );
  const [bankTransferBeneficiaryName, setBankTransferBeneficiaryName] = useState(
    realtorConfig.bankTransferBeneficiaryName || ''
  );
  const [bankTransferBankName, setBankTransferBankName] = useState(
    realtorConfig.bankTransferBankName || ''
  );
  const [bankTransferAccountNumber, setBankTransferAccountNumber] = useState(
    realtorConfig.bankTransferAccountNumber || ''
  );
  const [bankTransferInstructions, setBankTransferInstructions] = useState(
    realtorConfig.bankTransferInstructions || ''
  );
  const [verificationCodeExpiryMinutes, setVerificationCodeExpiryMinutes] =
    useState(realtorConfig.verificationCodeExpiryMinutes);
  const [defaultCheckInTime, setDefaultCheckInTime] = useState(
    realtorConfig.defaultCheckInTime
  );
  const [defaultCheckOutTime, setDefaultCheckOutTime] = useState(
    realtorConfig.defaultCheckOutTime
  );
  const [cancellationPolicySummary, setCancellationPolicySummary] = useState(
    realtorConfig.cancellationPolicySummary
  );
  const [defaultCheckInInstructions, setDefaultCheckInInstructions] = useState(
    realtorConfig.defaultCheckInInstructions
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setErrorMessage(null);

    try {
      const res = await updateRealtorConfig({
        businessName: businessName.trim(),
        tagline: tagline.trim(),
        domain: domain.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        whatsappNumber: whatsappNumber.trim(),
        officeAddress: officeAddress.trim(),
        paymentPolicy,
        depositPercentage: Number(depositPercentage),
        bankTransferBeneficiaryName: bankTransferBeneficiaryName.trim(),
        bankTransferBankName: bankTransferBankName.trim(),
        bankTransferAccountNumber: bankTransferAccountNumber.trim(),
        bankTransferInstructions: bankTransferInstructions.trim(),
        verificationCodeExpiryMinutes: Number(verificationCodeExpiryMinutes),
        defaultCheckInTime: defaultCheckInTime.trim(),
        defaultCheckOutTime: defaultCheckOutTime.trim(),
        cancellationPolicySummary: cancellationPolicySummary.trim(),
        defaultCheckInInstructions: defaultCheckInInstructions.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Could not update realtor settings.');
      } else {
        setSavedSuccess(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold mb-2">
          <Globe className="w-3.5 h-3.5" />
          <span>Single-Client Realtor Configuration ({realtorConfig.clientId})</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
          Realtor Client & Booking Policies
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Configure public branding, Paystack booking payment policy, and
          booking access code settings for this realtor client.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">
            Realtor client configuration and booking policies saved.
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Realtor Identity & Contact */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Building2 className="w-5 h-5 text-brand-700" />
            <h2 className="text-base font-bold text-stone-900">
              Realtor Business Profile & Domain
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Realtor Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Dedicated Client Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Public Brand Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Reservations Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Support Phone Number
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                WhatsApp Booking Concierge Number
              </label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Office Address
              </label>
              <input
                type="text"
                value={officeAddress}
                onChange={(e) => setOfficeAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Paystack Payment Policy */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <CreditCard className="w-5 h-5 text-brand-700" />
            <h2 className="text-base font-bold text-stone-900">
              Paystack Payment Policy & Confirmation Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Realtor Payment Policy
              </label>
              <select
                value={paymentPolicy}
                onChange={(e) =>
                  setPaymentPolicy(e.target.value as PaymentPolicyType)
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
              >
                <option value="FullPayment">
                  Full Payment Online (Auto-Confirms Booking on Paystack Verify)
                </option>
                <option value="Deposit">
                  Partial Deposit Online (Secures Booking with Deposit %)
                </option>
                <option value="PayAfterApproval">
                  Pay After Realtor Approval (Admin Approves First)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Deposit Percentage (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={depositPercentage}
                onChange={(e) => setDepositPercentage(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Used when Payment Policy is set to Deposit or when guest chooses
                Deposit checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2B: Official Bank Transfer Details */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Landmark className="w-5 h-5 text-brand-700" />
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Official Bank Transfer Details
              </h2>
              <p className="text-xs text-stone-500">
                Shown to customers choosing Bank Transfer at checkout. All incoming transfer receipts require manual admin verification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Beneficiary / Account Name
              </label>
              <input
                type="text"
                value={bankTransferBeneficiaryName}
                onChange={(e) => setBankTransferBeneficiaryName(e.target.value)}
                placeholder="e.g., Verdant Stays Hospitality Ltd"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankTransferBankName}
                onChange={(e) => setBankTransferBankName(e.target.value)}
                placeholder="e.g., Zenith Bank PLC"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={bankTransferAccountNumber}
                onChange={(e) => setBankTransferAccountNumber(e.target.value)}
                placeholder="e.g., 1018942201"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Transfer Instructions & Narrative Format
            </label>
            <input
              type="text"
              value={bankTransferInstructions}
              onChange={(e) => setBankTransferInstructions(e.target.value)}
              placeholder="e.g., Please use your Full Name or Phone Number as the transfer narrative."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>

        {/* Section 3: Verification Code Security & Check-In Rules */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-brand-700" />
            <h2 className="text-base font-bold text-stone-900">
              Code-Based Booking Access & Guest Policies
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="block text-xs font-semibold text-stone-700 mb-1">
                Booking Access Code Validity
              </span>
              <p className="px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-700">
                Reusable until 30 days after check-out
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Default Check-In Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={defaultCheckInTime}
                  onChange={(e) => setDefaultCheckInTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Default Check-Out Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={defaultCheckOutTime}
                  onChange={(e) => setDefaultCheckOutTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Cancellation Policy Summary
            </label>
            <textarea
              rows={2}
              value={cancellationPolicySummary}
              onChange={(e) => setCancellationPolicySummary(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Default Check-In Instructions (Revealed Only After Code Verification)
            </label>
            <textarea
              rows={3}
              value={defaultCheckInInstructions}
              onChange={(e) => setDefaultCheckInInstructions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-800 hover:bg-brand-900 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Configuration...' : 'Save Realtor Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
