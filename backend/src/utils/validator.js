const { ZodError } = require("zod");

/**
 * validate(schema, { target: 'body' | 'query' | 'params' })
 */
const validate =
  (schema, options = { target: "body" }) =>
  (req, res, next) => {
    try {
      const target = options.target || "body";
      const data = req[target] ?? {};

      const parsed = schema.parse(data);

      req.validated = req.validated || {};
      req.validated[target] = parsed;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // ✅ Zod v4 uses `issues`, not `errors`
        const errors = (error.issues || []).map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(422).json({
          success: false,
          message: `Invalid ${options.target} data`,
          target: options.target,
          errors,
        });
      }

      next(error);
    }
  };

module.exports = { validate };
