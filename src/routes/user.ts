import { Hono } from "hono";
import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { sign } from "hono/jwt";

export const userRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
}>();

userRouter.post("/signup", async (c) => {
  const body = await c.req.json();

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const user = await prisma.user.create({
      data: {
        username: body.data.username,
        password: body.data.password,
        name: body.data.name,
      },
    });
    const jwt = await sign(
      {
        id: user.id,
      },
      c.env.JWT_SECRET
    );

    return c.text(jwt);
  } catch (e) {
    console.log(e);
    c.status(400);
    return c.text("Invalid");
  }
});

userRouter.post("/signin", async (c) => {
  const body = await c.req.json();

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const user = await prisma.user.findFirst({
      where: {
        username: body.data.username,
        password: body.data.password,
      },
    });
    if (!user) {
      c.status(403);
      return c.json({
        message: "Incorrect creds",
      });
    }
    const jwt = await sign(
      {
        id: user.id,
      },
      c.env.JWT_SECRET
    );

    return c.text(jwt);
  } catch (e) {
    console.log(e);
    c.status(411);
    return c.text("Invalid");
  }
});

userRouter.post('/signout', async (c) => {
  const authHeader = c.req.header("authorization") || "";

  const prisma = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
      // Extract the token from the Authorization header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
          c.status(400);
          return c.json({
              message: "Authorization header with Bearer token is required"
          });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
          c.status(400);
          return c.json({
              message: "Token is required"
          });
      }

      c.status(200);
      return c.json({
          message: "Successfully signed out"
      });
  } catch (e) {
      console.log(e);
      c.status(500);
      return c.text('An error occurred while signing out');
  }
});

