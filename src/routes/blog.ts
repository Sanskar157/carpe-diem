import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono } from "hono";
import { verify } from "hono/jwt";

export const postRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    userId: string;
  };
}>();

//auth middleware
postRouter.use("/*", async (c, next) => {
  const authHeader = c.req.header("authorization") || "";
  const token = authHeader.split(" ")[1];
  console.log(token);

  try {
    const user = await verify(token, c.env.JWT_SECRET);
    if (user) {
      // @ts-ignore
      c.set("userId", user.id);
      await next();
    } else {
      c.status(403);
      return c.json({
        message: "You are not logged in",
      });
    }
  } catch (e) {
    c.status(403);
    return c.json({
      message: "You are not logged in",
    });
  }
});

// post blog
postRouter.post("/", async (c) => {
  const body = await c.req.json();

  const authorId = c.get("userId");
  console.log(authorId);
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const post = await prisma.post.create({
    // @ts-ignore
    data: {
      title: body.data.title,
      content: body.data.content,
      genre: body.data.genre,
      // @ts-ignore
      authorId: parseInt(authorId),
    },
  });

  return c.json({
    id: post.id,
  });
});

//update blog
postRouter.put("/", async (c) => {
  const body = await c.req.json();

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const postToUpdate = await prisma.post.findUnique({
    where: {
      id: body.data.id,
    },
  });

  if (!postToUpdate) {
    return c.json({ error: "Post not found" }, { status: 404 });
  }

  if (postToUpdate.published) {
    return c.json({ error: "Cannot update published post" }, { status: 403 });
  }

  const post = await prisma.post.update({
    where: {
      id: body.data.id,
    },
    data: {
      title: body.data.title,
      content: body.data.content,
    },
  });

  return c.json({
    id: post.id,
  });
});

//get all blogs on the platform
postRouter.get("/bulk", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const page = parseInt(c.req.query("page") || "1", 10); 
  const limit = parseInt(c.req.query("limit") || "10", 10); 

  if (page < 1 || limit < 1) {
    return c.json(
      {
        message: "Invalid pagination parameters. Page and limit must be greater than 0.",
      },
      400
    );
  }

  try {
    let posts;
    let totalPosts;

    if (!c.req.query("page") && !c.req.query("limit")) {
      posts = await prisma.post.findMany({
        select: {
          content: true,
          title: true,
          id: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      });
      totalPosts = posts.length; 
    } else {
      const offset = (page - 1) * limit;

      posts = await prisma.post.findMany({
        skip: offset,
        take: limit,
        select: {
          content: true,
          title: true,
          id: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      });

      totalPosts = await prisma.post.count(); 
    }

    return c.json({
      posts,
      pagination: {
        total: totalPosts,
        page,
        limit,
        totalPages: Math.ceil(totalPosts / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return c.json({ message: "An error occurred while fetching posts." }, 500);
  }
});

// get my published blogs
postRouter.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    c.status(401);
    return c.json({ message: "Unauthorized. Please log in." });
  }

  const body = await c.req.json();
  const publishedStatus = body?.data?.published; 

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const posts = await prisma.post.findMany({
      where: {
        authorId: Number(userId),
        ...(publishedStatus !== undefined && { published: publishedStatus }),
      },
      select: {
        id: true,
        title: true,
        content: true,
        published: true,
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    return c.json({
      posts,
    });
  } catch (error) {
    console.error("Error while fetching user blogs:", error);
    c.status(500);
    return c.json({
      message: "An error occurred while fetching blogs.",
    });
  }
});

// delete a blog by id
postRouter.delete("/:id", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const postId = parseInt(c.req.param("id"), 10);
  const userId = c.get("userId");

  if (!postId || isNaN(postId)) {
    return c.json({ message: "Invalid post ID." }, 400);
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return c.json({ message: "Blog not found." }, 404);
    }

    if (post.authorId !== Number(userId)) {
      return c.json(
        { message: "You are not authorized to delete this post." },
        403
      );
    }

    await prisma.post.delete({
      where: { id: postId },
    });

    return c.json({ message: "Blog deleted successfully." });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return c.json(
      { message: "An error occurred while deleting the blog." },
      500
    );
  }
});

// publish a blog
postRouter.put("/publish", async (c) => {
  const body = await c.req.json();

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  await prisma.post.update({
    where: {
      id: body.data.id,
    },
    data: {
      published: true,
    },
  });

  return c.json({
    message: "Blog published successfully."
  });
});


// get a specific blog
postRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  console.log(id)
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const post = await prisma.post.findFirst({
      where: {
        id: Number(id),
      },
      select: {
        id: true,
        title: true,
        content: true,
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    return c.json({
      post,
    });
  } catch (e) {
    c.status(404);
    return c.json({
      message: "Error while fetching post post",
    });
  }
});


// filter by genre
// delete account


// ai generated content
// frontend share blog  -> link
