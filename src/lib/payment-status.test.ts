import { describe, it, expect } from "vitest";
import { isPaymentConfirmed, PAID_ASAAS_STATUSES } from "./payment-status";

describe("isPaymentConfirmed", () => {
  it("accepts a PIX written off manually in the Asaas dashboard", () => {
    expect(isPaymentConfirmed({ asaas_status: "RECEIVED_IN_CASH" })).toBe(true);
    expect(isPaymentConfirmed({ status: "received_in_cash" })).toBe(true);
  });

  it("accepts RECEIVED and CONFIRMED", () => {
    expect(isPaymentConfirmed({ asaas_status: "RECEIVED" })).toBe(true);
    expect(isPaymentConfirmed({ asaas_status: "CONFIRMED" })).toBe(true);
    expect(isPaymentConfirmed({ status: "confirmed" })).toBe(true);
    expect(isPaymentConfirmed({ confirmed: true })).toBe(true);
  });

  it("rejects unpaid statuses", () => {
    expect(isPaymentConfirmed({ status: "pending", asaas_status: "PENDING" })).toBe(false);
    expect(isPaymentConfirmed({ status: "overdue", asaas_status: "OVERDUE" })).toBe(false);
    expect(isPaymentConfirmed({ status: "awaiting_payment" })).toBe(false);
    expect(isPaymentConfirmed(undefined)).toBe(false);
  });

  it("lists the three paid Asaas statuses", () => {
    expect([...PAID_ASAAS_STATUSES].sort()).toEqual(
      ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].sort(),
    );
  });
});
