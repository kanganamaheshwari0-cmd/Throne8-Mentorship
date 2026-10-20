
const test = require("node:test");
const assert = require("node:assert/strict");

// Isolated test: mock LedgerEntry before loading the service.
const ledgerModelPath = require.resolve("../models/LedgerEntry");
const servicePath = require.resolve("../services/ledgerEntryService");

const originalLedgerEntry = require.cache[ledgerModelPath];

function loadServiceWithMock(mockModel) {
  require.cache[ledgerModelPath] = {
    id: ledgerModelPath,
    filename: ledgerModelPath,
    loaded: true,
    exports: mockModel,
    children: [],
    paths: [],
  };

  delete require.cache[servicePath];

  return require("../services/ledgerEntryService");
}

function restoreService() {
  delete require.cache[servicePath];

  if (originalLedgerEntry) {
    require.cache[ledgerModelPath] = originalLedgerEntry;
  } else {
    delete require.cache[ledgerModelPath];
  }
}

// Supports both await LedgerEntry.findOne() and .findOne().lean().
function mockFindOne(value) {
  const query = Promise.resolve(value);
  query.lean = async () => value;
  return query;
}

function makeBookingAndPayment() {
  return {
    booking: {
      _id: "booking-test-1",
      pricePaise: 70000,
      commissionPaise: 14000,
      mentorGrossPaise: 56000,
      currency: "INR",
    },
    payment: {
      _id: "payment-test-1",
      amountPaise: 70000,
      currency: "INR",
      status: "CAPTURED",
    },
  };
}

test("captured payment creates three balanced ledger lines", async () => {
  const saved = [];

  const mockModel = {
    async create(document) {
      saved.push(document);
      return document;
    },

    findOne({ eventKey }) {
      const existing = saved.find(
        (entry) => entry.eventKey === eventKey
      );

      return mockFindOne(existing || null);
    },
  };

  try {
    const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
    const { booking, payment } = makeBookingAndPayment();

    const result = await recordPaymentCaptured({ booking, payment });

    assert.equal(result.created, 3);
    assert.equal(result.total, 3);
    assert.equal(saved.length, 3);

    const debit = saved
      .filter((entry) => entry.direction === "DEBIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0);

    const credit = saved
      .filter((entry) => entry.direction === "CREDIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0);

    assert.equal(debit, 70000);
    assert.equal(credit, 70000);
  } finally {
    restoreService();
  }
});

test("rejects payment that does not match the booking amount", async () => {
  const mockModel = {
    async create() {
      throw new Error("Should not create entries");
    },

    async findOne() {
      return null;
    },
  };

  try {
    const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
    const { booking, payment } = makeBookingAndPayment();

    payment.amountPaise = 60000;

    await assert.rejects(
      recordPaymentCaptured({ booking, payment }),
      /Payment does not match booking/
    );
  } finally {
    restoreService();
  }
});

test("rejects captured-payment recording for a non-captured payment", async () => {
  const mockModel = {
    async create() {
      throw new Error("Should not create entries");
    },

    async findOne() {
      return null;
    },
  };

  try {
    const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
    const { booking, payment } = makeBookingAndPayment();

    payment.status = "CREATED";

    await assert.rejects(
      recordPaymentCaptured({ booking, payment }),
      /Only a CAPTURED payment can be recorded/
    );
  } finally {
    restoreService();
  }
});

test("duplicate eventKey is treated as an already-existing entry", async () => {
  const saved = [];

  const mockModel = {
    async create(document) {
      const duplicate = saved.some(
        (entry) => entry.eventKey === document.eventKey
      );

      if (duplicate) {
        const error = new Error("Duplicate key");
        error.code = 11000;
        throw error;
      }

      saved.push(document);
      return document;
    },

    findOne({ eventKey }) {
      const existing = saved.find(
        (entry) => entry.eventKey === eventKey
      );

      return mockFindOne(existing || null);
    },
  };

  try {
    const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
    const { booking, payment } = makeBookingAndPayment();

    const first = await recordPaymentCaptured({ booking, payment });
    const second = await recordPaymentCaptured({ booking, payment });

    assert.equal(first.created, 3);
    assert.equal(first.total, 3);
    assert.equal(second.created, 0);
    assert.equal(second.total, 3);
    assert.equal(saved.length, 3);
  } finally {
    restoreService();
  }
});


test("retry after partial insert failure recovers missing ledger entries", async () => {
  const saved = [];
  let shouldFailOnce = true;

  const mockModel = {
    async create(document) {
      if (
        shouldFailOnce &&
        document.account === "PLATFORM_COMMISSION"
      ) {
        shouldFailOnce = false;
        throw new Error("Simulated database failure");
      }

      const duplicate = saved.some(
        (entry) => entry.eventKey === document.eventKey
      );

      if (duplicate) {
        const error = new Error("Duplicate key");
        error.code = 11000;
        throw error;
      }

      saved.push({ ...document });
      return document;
    },

    findOne({ eventKey }) {
      const existing = saved.find(
        (entry) => entry.eventKey === eventKey
      );

      return mockFindOne(existing || null);
    },
  };

  try {
    const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
    const { booking, payment } = makeBookingAndPayment();

    await assert.rejects(
      recordPaymentCaptured({ booking, payment }),
      /Simulated database failure/
    );

    assert.equal(saved.length, 1);

    const retry = await recordPaymentCaptured({ booking, payment });

    assert.equal(retry.created, 2);
    assert.equal(retry.total, 3);
    assert.equal(saved.length, 3);

    const debit = saved
      .filter((entry) => entry.direction === "DEBIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0);

    const credit = saved
      .filter((entry) => entry.direction === "CREDIT")
      .reduce((sum, entry) => sum + entry.amountPaise, 0);

    assert.equal(debit, 70000);
    assert.equal(credit, 70000);
  } finally {
    restoreService();
  }
});





























// const test = require("node:test");
// const assert = require("node:assert/strict");
// const path = require("node:path");

// // Isolated test: mock LedgerEntry before loading the service.
// const ledgerModelPath = require.resolve("../models/LedgerEntry");
// const servicePath = require.resolve("../services/ledgerEntryService");

// const originalLedgerEntry = require.cache[ledgerModelPath];

// function loadServiceWithMock(mockModel) {
//   require.cache[ledgerModelPath] = {
//     id: ledgerModelPath,
//     filename: ledgerModelPath,
//     loaded: true,
//     exports: mockModel,
//     children: [],
//     paths: [],
//   };

//   delete require.cache[servicePath];

//   return require("../services/ledgerEntryService");
// }

// function restoreService() {
//   delete require.cache[servicePath];

//   if (originalLedgerEntry) {
//     require.cache[ledgerModelPath] = originalLedgerEntry;
//   } else {
//     delete require.cache[ledgerModelPath];
//   }
// }

// function makeBookingAndPayment() {
//   return {
//     booking: {
//       _id: "booking-test-1",
//       pricePaise: 70000,
//       commissionPaise: 14000,
//       mentorGrossPaise: 56000,
//       currency: "INR",
//     },
//     payment: {
//       _id: "payment-test-1",
//       amountPaise: 70000,
//       currency: "INR",
//       status: "CAPTURED",
//     },
//   };
// }

// test("captured payment creates three balanced ledger lines", async () => {
//   const saved = [];

//   const mockModel = {
//     async create(document) {
//       saved.push(document);
//       return document;
//     },
   
//      findOne() {
//   return {
//     lean: async () => null,
//   };
// },

//   };

//   try {
//     const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
//     const { booking, payment } = makeBookingAndPayment();

//     const result = await recordPaymentCaptured({ booking, payment });

//     assert.equal(result.created, 3);
//     assert.equal(result.total, 3);
//     assert.equal(saved.length, 3);

//     const debit = saved
//       .filter((entry) => entry.direction === "DEBIT")
//       .reduce((sum, entry) => sum + entry.amountPaise, 0);

//     const credit = saved
//       .filter((entry) => entry.direction === "CREDIT")
//       .reduce((sum, entry) => sum + entry.amountPaise, 0);

//     assert.equal(debit, 70000);
//     assert.equal(credit, 70000);
//   } finally {
//     restoreService();
//   }
// });

// test("rejects payment that does not match the booking amount", async () => {
//   const mockModel = {
//     async create() {
//       throw new Error("Should not create entries");
//     },
//     async findOne() {
//       return null;
//     },
//   };

//   try {
//     const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
//     const { booking, payment } = makeBookingAndPayment();
//     payment.amountPaise = 60000;

//     await assert.rejects(
//       recordPaymentCaptured({ booking, payment }),
//       /Payment does not match booking/
//     );
//   } finally {
//     restoreService();
//   }
// });

// test("rejects captured-payment recording for a non-captured payment", async () => {
//   const mockModel = {
//     async create() {
//       throw new Error("Should not create entries");
//     },
//     async findOne() {
//       return null;
//     },
//   };

//   try {
//     const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
//     const { booking, payment } = makeBookingAndPayment();
//     payment.status = "CREATED";

//     await assert.rejects(
//       recordPaymentCaptured({ booking, payment }),
//       /Only a CAPTURED payment can be recorded/
//     );
//   } finally {
//     restoreService();
//   }
// });

// test("duplicate eventKey is treated as an already-existing entry", async () => {
//   const saved = [];
//   const existingKeys = new Set();

//   const mockModel = {
//     async create(document) {
//       if (existingKeys.has(document.eventKey)) {
//         const error = new Error("Duplicate key");
//         error.code = 11000;
//         throw error;
//       }

//       existingKeys.add(document.eventKey);
//       saved.push(document);
//       return document;
//     },

//     async findOne({ eventKey }) {
//       return existingKeys.has(eventKey) ? { eventKey } : null;
//     },
//   };

//   try {
//     const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
//     const { booking, payment } = makeBookingAndPayment();

//     const first = await recordPaymentCaptured({ booking, payment });
//     const second = await recordPaymentCaptured({ booking, payment });

//     assert.equal(first.created, 3);
//     assert.equal(second.created, 0);
//     assert.equal(saved.length, 3);
//   } finally {
//     restoreService();
//   }
// });

// test("partial insert failure is surfaced by recordPaymentCaptured", async () => {
//   let attempts = 0;

//   const mockModel = {
//     async create() {
//       attempts++;

//       if (attempts === 2) {
//         throw new Error("Simulated database failure");
//       }

//       return {};
//     },

//     async findOne() {
//       return null;
//     },
//   };

//   try {
//     const { recordPaymentCaptured } = loadServiceWithMock(mockModel);
//     const { booking, payment } = makeBookingAndPayment();

//     await assert.rejects(
//       recordPaymentCaptured({ booking, payment }),
//       /Simulated database failure/
//     );

//     assert.equal(attempts, 2);
//   } finally {
//     restoreService();
//   }
// });
