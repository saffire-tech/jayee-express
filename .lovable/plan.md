# Complete the Moolre setup for mobile-money collections

## Confirmed issue

Moolre is returning **UP02: “Merchant Account Setup Incomplete”** after the verification-code step. This means the app reaches Moolre correctly, but Moolre has not fully enabled the merchant account to continue to the final USSD PIN approval.

The app is already using Moolre’s live collection endpoint, `https://api.moolre.com/open/transact/payment`, as specified in Moolre’s documentation.

## What to do in your Moolre account

1. **Sign in to your Moolre merchant account.**
2. **Complete all business verification requirements.** Check for incomplete business identity, owner/director identification, Ghana Card or other ID, business registration documents, address, settlement details, or account verification notices.
3. **Confirm that the business wallet/account is active.** The account number configured in Jayee Express must belong to the same live merchant profile as the API username and keys.
4. **Ask Moolre to enable live Mobile Money Collections/Payin** on that exact account number.
5. **Ask them to enable the complete MTN OTP-to-USSD flow**, including:
   - sending the verification code;
   - accepting the verification code against the original transaction;
   - pushing the final Mobile Money PIN prompt.
6. **Confirm the enabled channels.** Ask Moolre to verify channels 13 (MTN), 6 (Telecel), and 7 (AirtelTigo), or tell you which channels your account currently supports.
7. **Do not send your private API key to support.** Give them only your merchant username/account number, the provider response code **UP02**, the time of the attempt, and the payment reference if requested.

## Message to send Moolre support

> Hello, my live Mobile Money Payin request sends the customer a verification code, but after submitting the code the API returns UP02: “Merchant Account Setup Incomplete,” and no final USSD PIN prompt is delivered. Please complete/activate my merchant account for live collections and enable the full OTP-to-USSD approval flow on my account. Please also confirm that MTN channel 13, Telecel channel 6, and AirtelTigo channel 7 are enabled.

Use the support contact included in Moolre’s response: **+233 59 607 0822**.

## Verification after activation

Run one low-value payment. The expected sequence is:

```text
Enter number → receive verification code → enter code in Jayee Express
→ receive USSD PIN prompt → approve → payment confirmed
```

If it still fails, capture the new response code and message. A response other than UP02 will identify the next issue; no payment-code change should be made while Moolre continues returning an account-setup error.
