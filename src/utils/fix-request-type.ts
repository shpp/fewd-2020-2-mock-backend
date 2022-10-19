// import { Request } from "./util/fix-request-type"
// do this if your Request suddenly appeared to be DOM/Browser request instead of CF Request
// this may happen if you import e.g. @supabase/supabase-js

import { Request as IttyRequest } from 'itty-router';
export type Request = CfRequestInit & IttyRequest & { headers: Headers };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Check = globalThis.Request;
