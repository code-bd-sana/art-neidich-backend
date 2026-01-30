const { ZodError } = require("zod");

/**
 * validate(schema, { target: 'body' | 'query' | 'params' })
 */
const validate =
  (schema, options = { target: "body" }) =>
  (req, res, next) => {
    const target = options.target || "body";
    const data = req[target] ?? {};

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(422).json({
        success: false,
        message: `Invalid ${target} data`,
        target,
        errors,
      });
    }

    // Flat plain object
    req.validated = { ...result.data };

    return next();
  };

module.exports = { validate };
