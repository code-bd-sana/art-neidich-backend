// External imports

const { readdirSync } = require("fs");
const fs = require("fs");
const path = require("path");

// Security Middleware Import
const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const hpp = require("hpp");
const morgan = require("morgan");

const { pathNotFoundHelper } = require("./helpers/not-found");
const errorHandler = require("./middleware/error-handler");
const { startSessionCleaner } = require("./services/SessionCleaner");

// Express app initialization
const app = express();
// Trust first proxy hop (e.g., load balancer) so X-Forwarded-For is honored
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware initialization
app.use(cors("*"));
app.use(helmet());
// Only sanitize req.body and req.params, not req.query (Express v5 compatibility)
// Custom sanitize middleware: only sanitize req.body and req.params (not req.query)
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});
app.use(hpp());
app.use(morgan("dev"));

// Request Rate Limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(limiter);

// Dynamically load routes
const routesPath = path.join(__dirname, "routes");
// Collect mounted routers for logging
const mounted = [];

readdirSync(routesPath).forEach((item) => {
  const itemPath = path.join(routesPath, item);
  const stat = fs.statSync(itemPath);

  // If it's a directory, try to load an index.js or compose all .js files inside
  if (stat.isDirectory()) {
    const routePrefix = `/api/v1/${item}`;
    let router;
    const indexFile = path.join(itemPath, "index.js");

    // If index.js exists, use it as the router
    if (fs.existsSync(indexFile)) {
      router = require(indexFile);
    } else {
      // Otherwise, compose all .js files in the directory into a single router
      router = express.Router();

      // Load all .js files in the directory
      readdirSync(itemPath).forEach((file) => {
        if (file.endsWith(".js"))
          router.use(require(path.join(itemPath, file)));
      });
    }

    // Mount the router
    app.use(routePrefix, router);
    mounted.push({ category: item, prefix: routePrefix, router });
  }

  // If it's a .js file directly under routes, mount it as a category
  if (stat.isFile() && item.endsWith(".js")) {
    // Derive category name from filename
    const name = path.basename(item, ".js");
    const routePrefix = `/api/v1/${name}`;

    // Load and mount the router
    const router = require(path.join(routesPath, item));

    // Mount the router
    app.use(routePrefix, router);
    mounted.push({ category: name, prefix: routePrefix, router });
  }
});

// Helper: extract routes from an express.Router instance
function getRoutesFromRouter(router) {
  // Extract all routes from a given express.Router instance
  const routes = [];

  // Guard clause
  if (!router || !router.stack) return routes;

  // Iterate over the router stack to find routes
  router.stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      // Extract HTTP methods for the route
      const methods = Object.keys(layer.route.methods || {}).map((m) =>
        m.toUpperCase(),
      );

      // Store the route path and methods
      routes.push({ path: layer.route.path, methods });
    }
    // Handle nested routers
    else if (layer.name === "router" && layer.handle && layer.handle.stack) {
      // Recursively extract routes from the nested router
      layer.handle.stack.forEach((l) => {
        if (l.route && l.route.path) {
          // Extract HTTP methods for the route
          const methods = Object.keys(l.route.methods || {}).map((m) =>
            m.toUpperCase(),
          );

          // Store the route path and methods
          routes.push({ path: l.route.path, methods });
        }
      });
    }
  });

  return routes;
}

// Console all routes grouped by category
// ANSI color helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
  },
};

// Log all mounted routes
console.log(
  `${colors.fg.cyan}${colors.bright}Registered routes:${colors.reset}`,
);

// Iterate over mounted routers and log their routes
mounted.forEach((m) => {
  // Log category and prefix
  console.log(
    `${colors.fg.yellow}\nCategory: ${colors.fg.magenta}${m.category} ${colors.reset}-> ${colors.fg.green}${m.prefix}${colors.reset}`,
  );

  // Extract and log routes
  const routes = getRoutesFromRouter(m.router);

  // If no routes found
  if (!routes.length) {
    console.log(`${colors.dim}  (no routes found)${colors.reset}`);
  }
  // Log each route
  else {
    routes.forEach((r) => {
      // Color-coded method string
      const methodStr = r.methods
        .map((mm) => {
          switch (mm) {
            case "GET":
              return `${colors.fg.green}${mm}${colors.reset}`;
            case "POST":
              return `${colors.fg.cyan}${mm}${colors.reset}`;
            case "PUT":
              return `${colors.fg.yellow}${mm}${colors.reset}`;
            case "DELETE":
              return `${colors.fg.red}${mm}${colors.reset}`;
            default:
              return `${colors.fg.magenta}${mm}${colors.reset}`;
          }
        })
        .join(`${colors.dim}|${colors.reset}`);

      console.log(
        `  ${methodStr} ${colors.fg.blue}${m.prefix}${colors.reset}${colors.fg.white}${r.path}${colors.reset}`,
      );
    });
  }
});

// Use the "Path not found" handler after all routes
app.use(pathNotFoundHelper);

// Centralized error handler (must be last middleware)
app.use(errorHandler);

/* 
// Start background session cleaner to mark stale logged-in statuses false
try {
  startSessionCleaner();
} catch (err) {
  console.error("Failed to start session cleaner:", err);
} */

// Module exports
module.exports = app;
