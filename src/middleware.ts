import { verify } from 'hono/jwt'
import { SignatureKey } from 'hono/utils/jwt/jws';

export function initMiddleware(app: { use: (arg0: string, arg1: (c: any, next: any) => Promise<any>) => void; }) {
  app.use('/api/v1/blog/*', async (c: { req: { header: (arg0: string) => string; }; env: { JWT_SECRET: SignatureKey; }; status: (arg0: number) => void; json: (arg0: { error: string; }) => any; }, next: () => void) => {
      const header = c.req.header("authorization") || "";
      const token = header.split(" ")[1]

      const response = await verify(token, c.env.JWT_SECRET)
      if (response.id) {
        next()
      } else {
        c.status(403)
        return c.json({ error: "unauthorized" })
      }
    })
    
}