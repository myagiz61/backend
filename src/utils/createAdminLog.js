import AdminLog from "../models/AdminLog.js";

export const createAdminLog = async ({
  adminId,
  action,
  message,
  targetUserId,
  actor = "admin",
  meta,
}) => {
  return AdminLog.create({
    adminId: actor === "admin" ? adminId : undefined,
    actor,
    action,
    message,
    targetUserId,
    meta,
  });
};
