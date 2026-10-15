import multer from "multer";
import ApiError from "../utils/ApiError.js";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB

  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new ApiError("Only PDF files are allowed", 400));
      return;
    }

    callback(null, true);
  },
});

export default upload;
