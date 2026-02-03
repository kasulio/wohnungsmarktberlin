import { gewobag } from "./propertyManagements/gewobag";

import type { PropertyManagement } from "./schemas";

export const propertyManagementList = [gewobag] satisfies Readonly<
  PropertyManagement[]
>;
