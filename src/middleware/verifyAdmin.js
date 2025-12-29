export const verifyAdmin = (req, res, next) => {
  console.log("🔐 VERIFY ADMIN CHECK");
  console.log("USER ID:", req.user?._id);
  console.log("USER ROLE:", req.user?.role);

  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Bu alana yetkiniz yok",
    });
  }

  next();
};
