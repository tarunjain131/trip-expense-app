import { DomainError } from "../errors";

/**
 * A settlement is a payment from someone who owes to someone who is owed.
 * Partial settlements are allowed; over-settlement is not: the amount may not
 * exceed what the payer owes nor what the receiver is still owed.
 */
export function validateSettlementAgainstBalances(input: {
  amountMinor: number;
  payerNet: number;
  receiverNet: number;
}): void {
  const { amountMinor, payerNet, receiverNet } = input;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new DomainError("Amount must be greater than zero.", "INVALID_AMOUNT", "amount");
  }
  if (payerNet >= 0) {
    throw new DomainError("This person does not owe anything right now.", "PAYER_NOT_DEBTOR");
  }
  if (receiverNet <= 0) {
    throw new DomainError("The other person is not owed anything right now.", "RECEIVER_NOT_CREDITOR");
  }
  const max = Math.min(-payerNet, receiverNet);
  if (amountMinor > max) {
    throw new DomainError(
      "That is more than is currently outstanding. Refresh and try again.",
      "OVER_SETTLEMENT",
      "amount",
    );
  }
}
