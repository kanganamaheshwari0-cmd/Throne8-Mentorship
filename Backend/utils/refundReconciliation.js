    
function compareRefundRecords({
  providerRefunds = [],
  localRefunds = [],
  embeddedRefunds = [],
}) {
  const issues = [];
  const providerById = new Map();
  const localById = new Map();

  for (const refund of providerRefunds) {
    if (refund.id) {
      providerById.set(refund.id, refund);
    }
  }

  for (const refund of [...localRefunds, ...embeddedRefunds]) {
    if (!refund.gatewayRefundId) continue;

    const id = refund.gatewayRefundId;
    const normalized = {
      amountPaise: Number(refund.amountPaise),
      status: refund.status,
    };

    const existing = localById.get(id);

    if (existing) {
      if (
        existing.amountPaise !== normalized.amountPaise ||
        existing.status !== normalized.status
      ) {
        issues.push({
          code: "LOCAL_REFUND_RECORD_MISMATCH",
          message: `Separate and embedded refund records differ for refund ${id}.`,
        });
      }
    } else {
      localById.set(id, normalized);
    }
  }

  for (const [id, provider] of providerById) {
    const local = localById.get(id);

    if (!local) {
      issues.push({
        code: "PROVIDER_REFUND_MISSING_LOCALLY",
        message: `Provider refund ${id} has no matching local refund ID.`,
      });
      continue;
    }

    if (local.amountPaise !== Number(provider.amount)) {
      issues.push({
        code: "REFUND_AMOUNT_MISMATCH",
        message: `Provider and local amounts differ for refund ${id}.`,
      });
    }

    const allowedStatuses = {
      pending: ["REQUESTED", "PROCESSING"],
      processed: ["PROCESSED"],
      failed: ["FAILED"],
    }[provider.status];

    if (allowedStatuses && !allowedStatuses.includes(local.status)) {
      issues.push({
        code: "REFUND_STATUS_MISMATCH",
        message: `Provider and local statuses differ for refund ${id}.`,
      });
    }
  }

  for (const id of localById.keys()) {
    if (!providerById.has(id)) {
      issues.push({
        code: "LOCAL_REFUND_MISSING_AT_PROVIDER",
        message: `Local refund ${id} was not found in the provider refund list.`,
      });
    }
  }

  return issues;
}

module.exports = { compareRefundRecords };
