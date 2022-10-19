import { z } from 'zod';

export const UserValidator = z.object({
  name: z.string(),
  surname: z.string(),
  avatar: z.string(),
  birthday: z.string(),
});
