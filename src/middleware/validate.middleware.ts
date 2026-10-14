import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import ApiError from "../utils/ApiError.js";

export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const issue = result.error.issues[0];

      const field = issue?.path.map(String).join(".");
      const message = field
        ? `${field}: ${issue.message}`
        : (issue?.message ?? "Invalid request body");

      return next(new ApiError(message, 400));
    }

    req.body = result.data;
    next();
  };

// import type { NextFunction, Request, Response } from "express";
// import type { ZodType } from "zod";
// import ApiError from "../utils/ApiError.js";

// export const validate =
//   (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
//     const result = schema.safeParse(req.body);

//     if (!result.success) {
//       const message = result.error.issues
//         .map((issue) =>
//           issue.path.length > 0
//             ? `${issue.path.map(String).join(".")}: ${issue.message}`
//             : issue.message,
//         )
//         .join(", ");

//       return next(new ApiError(message, 400));
//     }

//     req.body = result.data;
//     next();
//   };
