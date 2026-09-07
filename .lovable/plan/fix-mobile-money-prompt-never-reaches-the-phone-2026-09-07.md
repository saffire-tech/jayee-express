# Fix: mobile money prompt never reaches the phone

## What is happening

Payment attempts from the last two days all sit at "initialized" with no error recorded, and the one recorded failure says *"Invalid Phone no. Verification Code, Please request a code"* (Moolre code TP15). That means the charge request is reaching Moolre, but Moolre is answering with a "we need a verification code first" step rather than pushing the approval prompt — and the app currently swallows that reply, so nothing reaches the phone and nothing is written down about why.

The exact wording Moolre sends back is not being logged anywhere, so the first job is to capture it.

## Plan

1. **Record what the payment provider actually replies.** Log the response code and message (never the keys) for every charge start, and store them on the payment record. This makes the next failure self-explaining instead of a silent "initialized" row.

2. **Handle the verification-code step properly.**
   - Treat only the provider's explicit code-required reply as the "enter code" step, using its response code rather than guessing from wording.
   - Show the provider's own instruction text on screen (for MTN this is usually "dial *170# and choose Approvals / My Wallet to get a code"), so the buyer knows where the code comes from instead of waiting for an SMS that never arrives.
   - Add a "Get a new code" action that re-sends the request, since codes expire quickly.
   - When the code is submitted and the provider rejects it (wrong or expired), show that message and stay on the code screen instead of failing the whole payment.

3. **Make the waiting screen honest.** After the code is accepted, the buyer's phone shows the PIN prompt; the screen keeps polling as it does now, but it will say what it is waiting for and, if the provider reports failure, show the provider's reason.

4. **Verify with a real low-value payment** and read the newly logged provider replies to confirm the prompt is delivered end to end. If the logs show the account is configured for a different flow than the code-then-PIN one, report that back with the exact provider message before changing anything else.

## Technical notes

- `supabase/functions/_shared/moolre.ts`: return the provider `code`/`message` verbatim; base `requiresOtp` on codes (`TP14`, `TP15`) instead of a regex over the message; add explicit handling for the "code rejected" case so callers can distinguish it from a hard failure.
- `supabase/functions/initialize-payment/index.ts` (and the store/rider subscription starters, which share the same helper): log the provider code and message, and persist them to `payment_attempts.provider_status` / `last_error` on every outcome, not just hard failures.
- `src/components/payments/MoMoPaymentDialog.tsx`: surface the provider message on the code screen, add a resend action, and keep the code screen open on a rejected code.
- No change to order creation, wallets, commissions or payouts — `finalize_order_payment` and the reconciliation job stay exactly as they are.
