import Koa = require("koa");
import Router = require("./joi-router");

const { Joi } = Router;

const spec1: Router.Spec = {
  path: "/user",
  method: "POST",
  handler: (ctx: Koa.Context) => (ctx.body = ""),
};

new Router().route(spec1);

const spec2: Router.Spec = {
  method: "PATCH",
  path: "/user",
  validate: {
    type: "json",
  },
  handler: (ctx: Koa.Context) => (ctx.status = 201),
};

new Router().route(spec2);

const spec3: Router.Spec = {
  method: "PATCH",
  path: "/user",
  validate: {
    type: "json",
    body: Joi.any(),
  },
  handler: (ctx: Koa.Context) => (ctx.status = 201),
  pre: (_ctx, next) => next(),
};

new Router().route(spec3);

const spec4: Router.Spec = {
  method: "PATCH",
  path: "/user",
  validate: {
    type: "json",
    output: {
      201: {
        body: Joi.object(),
      },
      "400,404": {
        headers: Joi.object(),
        body: Joi.object(),
      },
      "500-599": {
        headers: Joi.object(),
      },
    },
    jsonOptions: {
      limit: "10kb",
    },
  },
  handler(ctx) {
    ctx.status = 201;
    ctx.body = {};
  },
};

new Router().route(spec4);

const spec5: Router.Spec = {
  method: "PUT",
  path: "/user",
  handler: (ctx) => {
    ctx.status = 201;
    ctx.body = ctx.request.body;
  },
  meta: "meta data",
};

new Router().route(spec5);

const spec6: Router.Spec = {
  method: "GET",
  path: "/user",
  handler: (ctx: Koa.Context) => {
    ctx.status = 201;
    ctx.body = ctx.request.params;
  },
};

new Router().route(spec6);

const spec7: Router.Spec = {
  method: "GET",
  path: "/user",
  validate: {
    query: {
      id: Joi.number(),
      name: Joi.string(),
    },
  },
  handler: (ctx: Koa.Context) => {
    ctx.status = 201;
    ctx.body = ctx.request.params;
  },
};

new Router().route(spec7);

const spec8: Router.Spec = {
  method: "POST",
  path: "/user",
  validate: {
    header: {
      authentication: Joi.string(),
    },
  },
  handler: (ctx: Koa.Context) => {
    ctx.status = 201;
    ctx.body = ctx.request.params;
  },
};

new Router().route(spec8);

new Router().route([spec1, spec2, spec3]);

new Router().routes.map(({ path }) => path);

const handler1 = async (ctx: Koa.Context) => {
  ctx.body = "hello world";
};

new Router().get("/", handler1);

new Router().get("/", { meta: { desc: "desc" } }, handler1);

new Router().get(
  "/user",
  {
    validate: {
      query: {
        id: Joi.number(),
        name: Joi.string(),
      },
    },
  },
  (ctx: Koa.Context) => {
    ctx.status = 201;
    ctx.body = ctx.request.params;
  }
);

const spec9: Router.Config = {
  validate: {
    body: {
      name: Joi.string(),
    },
    type: "json",
  },
};

const spec9Handler = (ctx: Koa.Context) => {
  ctx.status = 201;
  ctx.body = ctx.request.params;
};

new Router().get("/user", spec9, spec9Handler);

new Router().router.allowedMethods({ throw: true });

const middleware1 = async (ctx: Koa.DefaultContext, next: Koa.Next) => {
  console.log("middleware1");
  await next();
};

new Router().get("/", middleware1, handler1);

const middleware2 = async (ctx: Koa.Context, next: Koa.Next) => {
  console.log("middleware2");
  await next();
};

new Router().get("/", [middleware1, middleware2], handler1);

new Router().use(middleware1);

new Router().use("/:id", middleware1);

new Router().param(
  "/:id",
  async (id: string, ctx: Koa.DefaultContext, next: Koa.Next) => {
    ctx.state.id = id;
    await next();
  }
);

const config1: Router.Config = {
  validate: {
    type: "multipart",
    multipartOptions: {
      headers: {
        "content-type": "multipart/form-data",
      },
      limits: {
        fields: 5,
        fieldSize: 300000,
      },
    },
  },
};
const config2: Router.Config = {
  validate: {
    type: "multipart",
    multipartOptions: {
      headers: { "content-type": "foo" },
      limits: {
        fields: 5,
        fieldSize: 300000,
      },
    },
  },
};
new Router().get("/", config1, handler1);
