// services/catalog-service/middleware/rbac.middleware.js

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied. Insufficient permissions.",
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
};

const adminOnly = checkRole("admin");
const userOrAdmin = checkRole("user", "admin");

module.exports = {
  checkRole,
  adminOnly,
  userOrAdmin,
};
