import fs from "fs";
import path from "path";

export const safeDeleteFile = (file) => {
  try {
    if (!file) return;

    // string path
    if (typeof file === "string") {
      const fullPath = path.resolve(file);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      return;
    }

    // object { path: "..."}
    if (typeof file === "object" && file.path) {
      const fullPath = path.resolve(file.path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      return;
    }
  } catch (err) {
    console.error("SAFE FILE DELETE ERROR:", err.message);
  }
};
