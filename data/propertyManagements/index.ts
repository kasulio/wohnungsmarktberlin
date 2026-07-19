import { type PropertyManagement } from "../schemas";
import { berlinovo } from "./berlinovo";
import { gewobag } from "./gewobag";
import { deuwo } from "./deuwo";
import { vonovia } from "./vonovia";
import { stadtundland } from "./stadtundland";
import { degewo } from "./degewo";
import { howoge } from "./howoge";
import { type PropertyManagementId } from "./configs";

export const propertyManagements = {
  berlinovo,
  gewobag,
  deuwo,
  vonovia,
  stadtundland,
  degewo,
  howoge,
} satisfies Record<PropertyManagementId, PropertyManagement>;
