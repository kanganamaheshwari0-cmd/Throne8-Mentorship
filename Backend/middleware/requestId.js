const crypto = require("crypto");

const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];

  req.requestId =
    typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();

  res.setHeader("X-Request-Id", req.requestId);
  next();
};

module.exports = requestId;