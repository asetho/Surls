import type { Prisma } from "@prisma/client";
import { isAdminUser } from "./auth";

type OwnershipUser = {
  id: string;
  role: string;
};

export function shortLinkOwnershipWhere(user: OwnershipUser): Prisma.ShortLinkWhereInput {
  return isAdminUser(user) ? {} : { createdById: user.id };
}

export function clickEventOwnershipWhere(user: OwnershipUser): Prisma.ClickEventWhereInput {
  return isAdminUser(user) ? {} : { shortLink: { createdById: user.id } };
}

export function apiTokenOwnershipWhere(user: OwnershipUser): Prisma.ApiTokenWhereInput {
  return isAdminUser(user) ? {} : { userId: user.id };
}
