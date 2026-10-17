import { Types } from "mongoose";
import ApiError from "./ApiError.js";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export const isObjectId = (value: string): boolean =>
  OBJECT_ID_REGEX.test(value);

export const toObjectId = (value: string, label = "id"): Types.ObjectId => {
  if (!isObjectId(value)) {
    throw new ApiError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
};
