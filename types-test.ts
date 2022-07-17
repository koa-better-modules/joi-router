import koa = require ('koa');
import router = require ('./joi-router');

const { Joi } = router;

const spec1: router.Spec = {
    path: '/user',
    method: 'POST',
    handler: (ctx: koa.Context) => (ctx.body = ''),
};

new router().route(spec1);

const spec2: router.Spec = {
    method: 'PATCH',
    path: '/user',
    validate: {
        type: 'json',
    },
    handler: (ctx: koa.Context) => (ctx.status = 201),
};

new router().route(spec2);

const spec3: router.Spec = {
    method: 'PATCH',
    path: '/user',
    validate: {
        type: 'json',
        body: Joi.any(),
    },
    handler: (ctx: koa.Context) => (ctx.status = 201),
    pre: (_ctx, next) => next(),
};

new router().route(spec3);

const spec4: router.Spec = {
    method: 'PATCH',
    path: '/user',
    validate: {
        type: 'json',
        output: {
            201: {
                body: Joi.object(),
            },
            '400,404': {
                headers: Joi.object(),
                body: Joi.object(),
            },
            '500-599': {
                headers: Joi.object(),
            },
        },
        jsonOptions: {
            limit: '10kb',
        },
    },
    handler(ctx) {
        ctx.status = 201;
        ctx.body = {};
    },
};

new router().route(spec4);

const spec5: router.Spec = {
    method: 'PUT',
    path: '/user',
    handler: ctx => {
        ctx.status = 201;
        ctx.body = ctx.request.body;
    },
    meta: 'meta data',
};

new router().route(spec5);

const spec6: router.Spec = {
    method: 'GET',
    path: '/user',
    handler: (ctx: koa.Context) => {
        ctx.status = 201;
        ctx.body = ctx.request.params;
    },
};

new router().route(spec6);

const spec7: router.Spec = {
    method: 'GET',
    path: '/user',
    validate: {
        query: {
            id: Joi.number(),
            name: Joi.string(),
        },
    },
    handler: (ctx: koa.Context) => {
        ctx.status = 201;
        ctx.body = ctx.request.params;
    },
};

new router().route(spec7);

const spec8: router.Spec = {
    method: 'POST',
    path: '/user',
    validate: {
        header: {
            authentication: Joi.string(),
        },
    },
    handler: (ctx: koa.Context) => {
        ctx.status = 201;
        ctx.body = ctx.request.params;
    },
};

new router().route(spec8);

new router().route([spec1, spec2, spec3]);

new router().routes.map(({ path }) => path);

const handler1 = async (ctx: koa.Context) => {
    ctx.body = 'hello world';
};

new router().get('/', handler1);

new router().get('/', { meta: { desc: 'desc' } }, handler1);

new router().get(
    '/user',
    {
        validate: {
            query: {
                id: Joi.number(),
                name: Joi.string(),
            },
        },
    },
    (ctx: koa.Context) => {
        ctx.status = 201;
        ctx.body = ctx.request.params;
    },
);

const spec9: router.Config = {
    validate: {
        body: {
            name: Joi.string(),
        },
        type: 'json',
    },
};

const spec9Handler = (ctx: koa.Context) => {
    ctx.status = 201;
    ctx.body = ctx.request.params;
};

new router().get('/user', spec9, spec9Handler);

new router().router.allowedMethods({ throw: true });

const middleware1 = async (ctx: koa.Context, next: koa.Next) => {
    console.log('middleware1');
    await next();
};

new router().get('/', middleware1, handler1);

const middleware2 = async (ctx: koa.Context, next: koa.Next) => {
    console.log('middleware2');
    await next();
};

new router().get('/', [middleware1, middleware2], handler1);

new router().use(middleware1);

new router().use('/:id', middleware1);

new router().param('/:id', async (id: string, ctx: koa.Context, next: koa.Next) => {
    ctx.state.id = id;
    await next();
});

const config1: router.Config = {
    validate: {
        type: 'multipart',
        multipartOptions: {
            headers: {
                'content-type': 'multipart/form-data'
            },
            limits: {
                fields: 5,
                fieldSize: 300000,
            },
        },
    },
};
const config2: router.Config = {
    validate: {
        type: 'multipart',
        multipartOptions: {
            headers: { 'content-type': 'foo' },
            limits: {
                fields: 5,
                fieldSize: 300000,
            },
        },
    },
};
new router().get('/', config1, handler1);
