import { z } from "zod";

export const mailingListSignUpSchema = z.object({
  email: z.email("Die E-Mail Adresse ist nicht gültig"),
  district: z.array(z.string()),
  rooms: z.int(),
  price: z.int(),
});
