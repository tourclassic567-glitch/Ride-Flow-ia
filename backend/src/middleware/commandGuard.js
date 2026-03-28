// /src/middleware/commandGuard.js

const ALLOWED_TYPES = ["ride", "cargo", "delivery", "system"];

function commandGuard(req, res, next) {
  try {
    const token = req.headers["x-api-key"];

    // --- AUTH (mínimo viable)
    if (!token || token !== process.env.MIKE_API_KEY) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { id, type, command, payload } = req.body;

    // --- VALIDACIÓN ESTRUCTURAL
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "invalid id" });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: "invalid type" });
    }

    if (payload && typeof payload !== "object") {
      return res.status(400).json({ error: "invalid payload" });
    }

    // --- NORMALIZACIÓN (VARIABLES MIKE)
    req.mike = {
      session_id: id,
      service_type: type,
      action: command || "default",
      execution_data: payload || {},
      timestamp: Date.now(),
    };

    next();
  } catch (err) {
    return res.status(500).json({ error: "middleware failure" });
  }
}

module.exports = commandGuard;
