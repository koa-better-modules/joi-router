'use strict';

const Koa = require('koa');
const KoaJoiRouter = require('..');
const assert = require('assert');
const request = require('supertest');
const http = require('http');
const Joi = require('joi');
const methods = require('../methods');
const slice = require('../sliced');
const MiddlewareGenerator = require('./test-utils').MiddlewareGenerator;

function makeRouterApp(router) {
  const app = new Koa();
  app.use(router.middleware());
  return app;
}

function test(app) {
  return request(http.createServer(app.callback()));
}

class CustomError extends Error {
  constructor(status, msg) {
    super();
    this.status = status;
    this.msg = msg;
  }
}

async function errorHandler(ctx, next) {
  try {
    await next();
  } catch (error) {
    let status = 400;
    let msg = 'unknown';
    if (error instanceof CustomError) {
      status = error.status;
      msg = error.msg;
    }
    ctx.status = status;
    ctx.body = msg;
  }
}

describe('@koa-better-modules/joi-router', () => {
  it('exposes a function', (done) => {
    assert.equal('function', typeof KoaJoiRouter);
    done();
  });

  it('is a constructor', (done) => {
    const r = new KoaJoiRouter();
    assert(r instanceof KoaJoiRouter);
    done();
  });

  it('exposes the Joi module', (done) => {
    assert.equal(KoaJoiRouter.Joi, Joi);
    done();
  });

  describe('routes', () => {
    it('is an array', (done) => {
      const r = new KoaJoiRouter();
      assert(Array.isArray(r.routes), 'expected .routes to be an Array');
      done();
    });
  });

  describe('route()', () => {
    describe('spec argument', () => {
      it('is required', (done) => {
        const r = new KoaJoiRouter();

        assert.throws(() => {
          r.route();
        }, /missing spec/);

        done();
      });

      describe('must contain', () => {
        it('path', (done) => {
          assert.throws(() => {
            new KoaJoiRouter().route({
              method: [],
              handler: () => { }
            });
          }, /invalid route path/);
          done();
        });

        it('at least one method', (done) => {
          assert.throws(() => {
            new KoaJoiRouter().route({
              path: '/',
              handler: () => { }
            });
          }, /missing route method/);

          assert.throws(() => {
            new KoaJoiRouter().route({
              path: '/',
              method: [],
              handler: () => { }
            });
          }, /missing route method/);

          done();
        });

        it('handler', (done) => {
          assert.throws(() => {
            new KoaJoiRouter().route({
              method: ['get'],
              path: '/'
            });
          }, /route handler/);
          done();
        });

        it('handler as generator function', (done) => {
          assert.throws(() => {
            new KoaJoiRouter().route({
              method: ['get'],
              path: '/',
              handler: function* () { }
            });
          }, /must not be GeneratorFunctions/);
          done();
        });
      });

      describe('when defining validate', () => {
        it('honors the failure code specified', (done) => {
          const r = new KoaJoiRouter();
          r.route({
            path: '/',
            method: 'get',
            handler: () => { },
            validate: {
              failure: 404
            }
          });

          assert.equal(404, r.routes[0].validate.failure);
          done();
        });
      });

      describe('method', () => {
        it('can be a string or array', (done) => {

          const tests = [
            ['get', 1],
            [['get'], 1],
            [['PUT', 'POST'], 1],
            [null, 0],
            [undefined, 0],
            [{}, 0],
            [['del', {}], 0]
          ];

          const r = new KoaJoiRouter();
          const fn = () => { };

          tests.forEach((test) => {
            const method = test[1] === 0 ?
              assert.throws :
              assert.doesNotThrow;

            method(() => {
              r.route({
                method: test[0],
                path: '/',
                handler: fn
              });
            });
          });

          done();
        });
      });

      describe('path', () => {
        it('can be a string', (done) => {
          const r = new KoaJoiRouter();
          const fn = () => { };

          assert.doesNotThrow(() => {
            r.get('/', fn);
          });

          done();
        });
      });

      describe('pre', () => {
        it('should run before validators and handler', async () => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'post',
            path: '/',
            validate: {
              type: 'json',
              body: {
                v: Joi.number()
              }
            },
            pre: (ctx, next) => {
              if (ctx.request.body) {
                ctx.throw(500, 'pre called after parser');
              }
              return next();
            },
            handler: (ctx) => {
              console.log('ctx.request.body', ctx.request.body);
              ctx.body = ctx.request.body;
            }
          });

          return test(makeRouterApp(r))
            .post('/')
            .send({ v: '42' })
            .expect({ v: 42 });
        });
      });

      describe('handler', () => {
        function testHandler(handler, expectedBody, done) {
          const r = new KoaJoiRouter();

          r.route({
            method: 'get',
            path: '/',
            handler: handler
          });

          return test(makeRouterApp(r)).get('/')
            .expect(expectedBody, done);
        }

        it('can be a single middleware', (done) => {
          const middleware = new MiddlewareGenerator();

          testHandler(middleware.generate(), middleware.getExpectedBody(), done);
        });

        it('can be an array of multiple middleware', (done) => {
          const middleware = new MiddlewareGenerator();

          testHandler([
            middleware.generate(),
            middleware.generate()
          ], middleware.getExpectedBody(), done);
        });

        it('can be nested arrays of multiple middleware', (done) => {
          const middleware = new MiddlewareGenerator();

          testHandler([
            middleware.generate(), [
              middleware.generate(), [
                middleware.generate()
              ]
            ],
            middleware.generate()
          ], middleware.getExpectedBody(), done);
        });
      });
    });

    it('adds route to the routes array', (done) => {
      const r = new KoaJoiRouter();
      assert.equal(0, r.routes.length);

      r.route({
        method: 'put',
        path: '/asdf/:id',
        handler: () => { }
      });

      assert.equal(1, r.routes.length);
      done();
    });

    it('adds routes to the routes array', (done) => {
      const r = new KoaJoiRouter();
      assert.equal(0, r.routes.length);

      r.route([
        {
          method: 'put',
          path: '/asdf/:id',
          handler: () => { }
        },
        {
          method: 'get',
          path: '/asdf/:id',
          handler: () => { }
        }
      ]);

      assert.equal(2, r.routes.length);
      done();
    });

    it('exposes the route definition to the handler context', (done) => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'GET',
        path: '/a',
        validate: {
          query: Joi.object().keys({
            q: Joi.number().min(5).max(8).required()
          }).options({
            allowUnknown: true
          })
        },
        handler: async function handler(ctx) {
          ctx.status = 204;

          try {
            assert.equal('object', typeof ctx.state.route);

            assert(Array.isArray(ctx.state.route.method),
              'route.method should be an array');

            assert.equal(1, ctx.state.route.method.length);
            assert.equal('get', ctx.state.route.method[0]);
            assert.equal('/a', ctx.state.route.path);
            assert(ctx.state.route.validate.query, 'missing spec.validate.query');
            assert('function', typeof ctx.state.route.handler);
            assert.notEqual(handler, ctx.state.route.handler);
          } catch (err) {
            ctx.status = 500;
            ctx.body = err.stack;
          }
        }
      });

      const app = new Koa();
      app.use(r.middleware());
      test(app).get('/a?q=6').expect(204, (err, res) => {
        if (err) console.error(res.text);
        done(err);
      });
    });
  });

  describe('request.params', () => {
    it('are defined based off of the route definition', (done) => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'get',
        path: '/product/:id/:action',
        handler: async (ctx) => {
          assert(typeof ctx.params === 'object' && ctx.params !== null,
            'missing params');
          assert.equal(4, ctx.params.id);
          assert.equal('remove', ctx.params.action);
          ctx.status = 200;
        }
      });

      const app = new Koa();
      app.use(r.middleware());
      test(app).get('/product/4/remove').expect(200, done);
    });
  });

  describe('request.body', () => {
    describe('when expected type is', () => {

      describe('json', () => {
        describe('and valid json is sent', () => {
          it('is parsed as json', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: fn,
              validate: {
                type: 'json'
              }
            });

            function fn(ctx) {
              ctx.body = ctx.request.body.last + ' ' + ctx.request.body.first;
            }

            const app = new Koa();
            app.use(r.middleware());
            test(app).post('/')
              .send({
                last: 'Heckmann',
                first: 'Aaron'
              })
              .expect(200)
              .expect('Heckmann Aaron', done);
          });
        });

        describe('and non-json is sent', () => {
          it('fails', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: function (ctx) {
                ctx.status = 204;
              },
              validate: {
                type: 'json'
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .type('form')
              .send({
                name: 'Pebble'
              })
              .expect(400, done);
          });

          describe('and validate.continueOnError is true', () => {
            it('runs the route and sets ctx.invalid', (done) => {
              const r = new KoaJoiRouter();

              r.route({
                method: 'post',
                path: '/',
                validate: {
                  type: 'json',
                  continueOnError: true
                },
                handler: (ctx) => {
                  ctx.status = 200;
                  ctx.body = ctx.invalid.type.msg;
                }
              });

              const app = new Koa();
              app.use(r.middleware());

              test(app)
                .post('/')
                .type('form')
                .send({
                  name: 'Pebble'
                })
                .expect(200)
                .expect('expected json', done);
            });

            describe('and an error is thrown in route', () => {
              it('does not catch it', (done) => {
                const r = new KoaJoiRouter();

                r.route({
                  method: 'post',
                  path: '/',
                  validate: {
                    type: 'json',
                    continueOnError: true
                  },
                  handler: (ctx) => {
                    if (ctx.invalid) {
                      throw new CustomError(200, ctx.invalid.type.msg);
                    }
                  }
                });

                const app = new Koa();
                app.use(errorHandler);
                app.use(r.middleware());

                test(app)
                  .post('/')
                  .type('form')
                  .send({
                    name: 'Pebble'
                  })
                  .expect(200)
                  .expect('expected json', done);
              });
            });
          });
        });

        describe('and invalid json is sent', () => {
          const invalid = '{' + JSON.stringify({
            name: 'Pebble'
          });

          it('fails', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: (ctx) => {
                ctx.status = 204;
              },
              validate: {
                type: 'json'
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .type('json')
              .send(invalid)
              .expect(400, done);
          });

          describe('and validate.continueOnError is true', () => {
            it('runs the route and sets ctx.invalid', (done) => {
              const r = new KoaJoiRouter();

              r.route({
                method: 'post',
                path: '/',
                validate: {
                  type: 'json',
                  continueOnError: true
                },
                handler: (ctx) => {
                  ctx.status = 200;
                  ctx.body = ctx.invalid &&
                    ctx.invalid.type &&
                    ctx.invalid.type.msg;
                }
              });

              const app = new Koa();
              app.use(r.middleware());

              test(app)
                .post('/')
                .type('json')
                .send(invalid)
                .expect(200)
                .expect((res) => {
                  assert(
                    /Unexpected token/.test(res.text) || /Expected property name/.test(res.text),
                    `expected JSON parse error, got: ${res.text}`
                  );
                })
                .end(done);
            });
          });
        });
      });

      describe('form', () => {
        describe('and valid form data is sent', () => {
          it('is parsed as form data', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: fn,
              validate: {
                type: 'form'
              }
            });

            function fn(ctx) {
              ctx.body = ctx.request.body.last + ' ' + ctx.request.body.first;
            }

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .send({
                last: 'Heckmann',
                first: 'Aaron'
              })
              .type('form')
              .expect(200)
              .expect('Heckmann Aaron')
              .end(done);
          });
        });

        describe('and non-form data is sent', () => {
          it('fails', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: (ctx) => {
                ctx.status = 204;
              },
              validate: {
                type: 'form'
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .send({
                last: 'heckmann',
                first: 'aaron'
              })
              .type('json')
              .expect(400, done);
          });

          describe('and validate.continueOnError is true', () => {
            it('runs the route and sets ctx.invalid', (done) => {
              const r = new KoaJoiRouter();

              r.route({
                method: 'post',
                path: '/',
                validate: {
                  type: 'form',
                  continueOnError: true
                },
                handler: (ctx) => {
                  ctx.status = 200;
                  ctx.body = ctx.invalid.type.msg;
                }
              });

              const app = new Koa();
              app.use(r.middleware());

              test(app)
                .post('/')
                .send({
                  last: 'Heckmann',
                  first: 'Aaron'
                })
                .type('json')
                .expect(200)
                .expect('expected x-www-form-urlencoded', done);
            });
          });
        });

        describe('and invalid form data is sent', () => {
          it('fails', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              handler: (ctx) => {
                ctx.status = 204;
              },
              validate: {
                type: 'form'
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .expect(400, done);
          });

          describe('and validate.continueOnError is true', () => {
            it('runs the route and sets ctx.invalid', (done) => {
              const r = new KoaJoiRouter();

              r.route({
                method: 'post',
                path: '/',
                validate: {
                  type: 'form',
                  continueOnError: true
                },
                handler: (ctx) => {
                  ctx.status = 200;
                  ctx.body = ctx.invalid.type.msg;
                }
              });

              const app = new Koa();
              app.use(r.middleware());

              test(app)
                .post('/')
                .expect(200)
                .expect('expected x-www-form-urlencoded', done);
            });
          });
        });
      });

      describe('multipart', () => {
        it('is undefined', (done) => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'put',
            path: '/',
            type: 'multipart',
            handler: (ctx) => {
              ctx.status = undefined === ctx.request.body ?
                200 :
                500;
            },
            validate: {
              type: 'multipart'
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          const b = Buffer.alloc(1024);
          b.fill('a');

          test(app)
            .put('/')
            .attach('file1', b)
            .expect(200, done);
        });
      });
    });
  });

  describe('request.parts', () => {
    describe('when expected type is', () => {
      'stream multipart'.split(' ').forEach((type) => {
        describe(`"${type}"`, () => {
          it('is a co-busboy object', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'put',
              path: '/',
              handler: async (ctx) => {
                let filename;
                let part;
                while ((part = await ctx.request.parts)) {
                  filename = part.filename;
                  part.resume();
                }

                // eslint-disable-next-line require-atomic-updates
                ctx.body = {
                  color: ctx.request.parts.field.color,
                  file: filename
                };
              },
              validate: {
                type: type
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .put('/')
              .attach('file1', `${__dirname}/fixtures/koa.png`)
              .field('color', 'green')
              .expect('{"color":"green","file":"koa.png"}', done);
          });
        });
      });

      describe('not specified', () => {
        it('is undefined', (done) => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'put',
            path: '/',
            handler: (ctx) => {
              ctx.status = undefined === ctx.request.parts ?
                200 :
                500;
            },
            validate: {}
          });

          const app = new Koa();
          app.use(r.middleware());

          const b = Buffer.alloc(1024);
          b.fill('a');

          test(app)
            .put('/')
            .attach('file1', b)
            .expect(200, done);
        });
      });
    });
  });

  describe('validation', () => {
    describe('of querystring', () => {
      describe('with', () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/a',
          validate: {
            query: Joi.object().keys({
              q: Joi.number().min(5).max(8).required(),
              s: Joi.string().alphanum().length(6)
            }).options({
              allowUnknown: true
            })
          },
          handler: (ctx) => {
            ctx.body = ctx.request.query;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        it('missing querystring', (done) => {
          test(app).get('/a')
            .expect(400, done);
        });

        it('invalid q and invalid s', (done) => {
          test(app).get('/a?q=100&s=asdfhjkl')
            .expect(400, done);
        });

        it('invalid q and valid s', (done) => {
          test(app).get('/a?q=4&s=asdfgh')
            .expect(400, done);
        });

        it('valid q and invalid s', (done) => {
          test(app).get('/a?q=5&s=dfgh')
            .expect(400, done);
        });

        it('valid q and valid s', (done) => {
          test(app).get('/a?q=5&s=as9fgh')
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(5, res.body.q);
              assert.equal('as9fgh', res.body.s);
              done(err);
            });
        });

        it('valid q and valid s + unspecified values', (done) => {
          test(app).get('/a?q=5&s=as9fgh&sort=10')
            .end((err, res) => {
              assert.equal(5, res.body.q);
              assert.equal('as9fgh', res.body.s);
              assert.equal(10, res.body.sort);
              done(err);
            });
        });
      });

      it('retains the casted values in the route (gh-6, gh-21)', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/a',
          validate: {
            query: Joi.object().keys({
              d: Joi.date().required(),
              n: Joi.number().required(),
              b: Joi.boolean().required()
            })
          },
          handler: (ctx) => {
            ctx.body = {
              query: ctx.request.query,
              date: {
                type: typeof ctx.request.query.d,
                instance: ctx.request.query.d instanceof Date
              },
              number: {
                type: typeof ctx.request.query.n
              },
              bool: {
                type: typeof ctx.request.query.b
              }
            };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app).get('/a?d=7-27-2016&n=34&b=true')
          .end((err, res) => {
            assert.equal('object', res.body.date.type);
            assert.equal(true, res.body.date.instance);
            assert.equal('number', res.body.number.type);
            assert.equal('boolean', res.body.bool.type);
            done(err);
          });
      });
    });

    describe('of params', () => {
      describe('when using named param captures', () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/id/:first-:second',
          validate: {
            params: Joi.object().keys({
              first: Joi.number().min(5).max(10),
              second: Joi.number().max(1000)
            })
          },
          handler: (ctx) => {
            ctx.body = ctx.request.params;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        it('with invalid first match', (done) => {
          test(app).get('/id/2-9')
            .expect(400, done);
        });

        it('with invalid second match', (done) => {
          test(app).get('/id/7-1001')
            .expect(400, done);
        });

        it('with valid matches', (done) => {
          test(app).get('/id/7-1000')
            .expect(200, done);
        });
      });

      describe('with', () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/a/:quantity/:sku',
          validate: {
            params: Joi.object().keys({
              quantity: Joi.number().min(5).max(8).required(),
              sku: Joi.string().alphanum().length(6)
            })
          },
          handler: (ctx) => {
            ctx.body = ctx.request.params;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        it('invalid quantity and invalid sku', (done) => {
          test(app).get('/a/as/asdfgh')
            .expect(400, done);
        });

        it('invalid quantity and valid sku', (done) => {
          test(app).get('/a/4/asdfgh')
            .expect(400, done);
        });

        it('valid quantity and invalid sku', (done) => {
          test(app).get('/a/5/dfgh')
            .expect(400, done);
        });

        it('valid quantity and valid sku', (done) => {
          test(app).get('/a/5/as9fgh')
            .expect(200)
            .expect('Content-Type', /json/)
            .set('Accept', 'application/json')
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(5, res.body.quantity);
              assert.equal('as9fgh', res.body.sku);
              done(err);
            });
        });
      });

      it('retains the casted values in the route', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/:field/:d/:n/:b',
          validate: {
            params: Joi.object().keys({
              d: Joi.date().required(),
              n: Joi.number().required(),
              b: Joi.boolean().required(),
              field: Joi.any()
            })
          },
          handler: async function (ctx) {
            const params = ctx.request.params.field === 'request' ?
              ctx.request.params :
              ctx.params;

            ctx.body = {
              params: params,
              date: {
                type: typeof params.d,
                instance: params.d instanceof Date
              },
              number: {
                type: typeof params.n
              },
              bool: {
                type: typeof params.b
              }
            };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app).get('/request/7-27-2016/34/true')
          .end((err, res) => {
            if (err) return done(err);
            assert.equal('object', res.body.date.type);
            assert.equal(true, res.body.date.instance);
            assert.equal('number', res.body.number.type);
            assert.equal('boolean', res.body.bool.type);

            test(app).get('/params/7-27-2016/34/true')
              .end((err, res) => {
                assert.equal('object', res.body.date.type);
                assert.equal(true, res.body.date.instance);
                assert.equal('number', res.body.number.type);
                assert.equal('boolean', res.body.bool.type);
                done(err);
              });
          });
      });
    });

    describe('of headers', () => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'post',
        path: '/a/b',
        validate: {
          header:
            Joi.object({ 'x-for-fun': Joi.number().min(5).max(8).required() })
              .options({ allowUnknown: true })
        },
        handler: (ctx) => {
          ctx.status = 204;
        }
      });

      const app = new Koa();
      app.use(r.middleware());

      it('with missing header fails', (done) => {
        test(app).post('/a/b').expect(400, done);
      });

      it('with invalid header (min) fails', (done) => {
        test(app).post('/a/b').set('X-For-Fun', 4).expect(400, done);
      });

      it('with invalid header (max) fails', (done) => {
        test(app).post('/a/b').set('X-For-Fun', 9).expect(400, done);
      });

      it('with valid header works', (done) => {
        test(app).post('/a/b').set('X-For-Fun', 6).expect(204, done);
      });
    });

    describe('of body', () => {
      describe('when validate.type', () => {
        describe('is specified', () => {
          const tests = {
            json: 1,
            form: 1,
            stream: 0
          };

          Object.keys(tests).forEach((name) => {
            describe('with ' + name, () => {
              it(tests[name] ? 'works' : 'fails', (done) => {
                const r = new KoaJoiRouter();

                const method = tests[name] ?
                  assert.doesNotThrow :
                  assert.throws;

                method(() => {
                  r.route({
                    method: 'post',
                    path: '/',
                    handler: () => { },
                    validate: {
                      body: Joi.object({ name: Joi.string() }),
                      type: name
                    }
                  });
                });

                done();
              });
            });
          });
        });

        describe('is not specified', () => {
          it('fails', (done) => {
            const r = new KoaJoiRouter();

            assert.throws(() => {
              r.route({
                method: 'post',
                path: '/',
                handler: () => { },
                validate: {
                  body: Joi.object({ name: Joi.string() })
                }
              });
            }, /validate\.type must be declared/);

            done();
          });
        });
      });

      describe('with', () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/a/b',
          validate: {
            body: Joi.object().keys({
              quantity: Joi.number().min(5).max(8).required(),
              sku: Joi.string()
            }),
            type: 'json'
          },
          handler: (ctx) => {
            ctx.status = 200;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        it('no posted values', (done) => {
          test(app).post('/a/b').expect(400, done);
        });

        it('invalid number and valid string', (done) => {
          test(app).post('/a/b')
            .send({
              quantity: 4,
              sku: 'x'
            })
            .expect(400, done);
        });

        it('valid number and invalid string', (done) => {
          test(app).post('/a/b')
            .send({
              quantity: 6,
              sku: { x: 'test' }
            })
            .expect(400, done);
        });

        it('valid number and missing non-required string', (done) => {
          test(app).post('/a/b')
            .send({ quantity: 6 })
            .expect(200, done);
        });

        it('valid values', (done) => {
          test(app).post('/a/b')
            .send({
              quantity: 6,
              sku: 'x'
            })
            .expect(200, done);
        });

        it('valid values + unspecified values', (done) => {
          test(app).post('/a/b')
            .send({
              quantity: 6,
              sku: 'x',
              a: 1
            })
            .expect(400, done);
        });
      });

      describe('when invalid data is submitted', () => {
        describe('and validate.continueOnError is true', () => {
          it('runs the route and sets ctx.invalid', (done) => {
            const r = new KoaJoiRouter();

            r.route({
              method: 'post',
              path: '/',
              validate: {
                type: 'json',
                continueOnError: true,
                body: {
                  name: Joi.string().min(10)
                }
              },
              handler: (ctx) => {
                ctx.status = 200;
                ctx.body = !!ctx.invalid;
              }
            });

            const app = new Koa();
            app.use(r.middleware());

            test(app)
              .post('/')
              .send({ name: 'Pebble' })
              .expect(200)
              .expect('true', done);
          });

          describe('and an error is thrown in route', () => {
            it('does not catch it', (done) => {
              const r = new KoaJoiRouter();

              r.route({
                method: 'post',
                path: '/',
                validate: {
                  type: 'json',
                  continueOnError: true,
                  body: {
                    name: Joi.string().min(10)
                  }
                },
                handler: (ctx) => {
                  if (ctx.invalid) {
                    const msg = ctx.invalid.body && ctx.invalid.body.msg;
                    throw new CustomError(200, msg);
                  }
                }
              });

              const app = new Koa();
              app.use(errorHandler);
              app.use(r.middleware());

              test(app)
                .post('/')
                .send({ name: 'Pixel' })
                .expect(200)
                .expect('"name" length must be at least 10 characters long', done);
            });
          });
        });
      });

    });

    describe('of parts (uploads)', () => {
      it('works', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: {
            type: 'multipart'
          },
          handler: (ctx) => {
            ctx.status = 200;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app).post('/').send({ hi: 'there' }).expect(400, (err) => {
          if (err) return done(err);

          const b = Buffer.alloc(1024);
          b.fill('a');

          test(app).post('/')
            .attach('file1', b)
            .expect(200, done);
        });
      });
    });

    describe('of output', () => {
      describe('status code patterns', () => {
        it('allows single status codes', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/single',
              validate: {
                output: {
                  '200': { body: Joi.any().equal('asdr') }
                }
              },
              handler: () => { }
            });
          });
        });

        it('allows commas', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/commas',
              validate: {
                output: {
                  '201,202': { body: Joi.any().equal('band-reject') }
                }
              },
              handler: () => { }
            });
          });
        });

        it('allows spaces between status codes', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'post',
              path: '/spaces',
              validate: {
                output: {
                  '400, 401': { body: Joi.any().equal('low-pass') }
                }
              },
              handler: () => { }
            });
          });
        });

        it('allows ranges', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'post',
              path: '/ranges',
              validate: {
                output: {
                  '402-404': { body: Joi.any().equal('hi-pass') }
                }
              },
              handler: () => { }
            });
          });
        });

        it('allows combinations of integers, commas and ranges', async () => {
          const r = new KoaJoiRouter();

          assert.doesNotThrow(() => {
            r.route({
              method: 'post',
              path: '/combo/:status',
              validate: {
                output: {
                  '500-502, 504 ,506-510,201': { body: Joi.any().equal('band-pass') }
                }
              },
              handler: function (ctx) {
                ctx.status = parseInt(ctx.params.status, 10);

                if (ctx.params.status === '200') {
                  ctx.body = { 'pass-thru': 1 };
                } else {
                  ctx.body = 'band-pass';
                }
              }
            });
          });

          const app = new Koa();
          app.use(r.middleware());

          await test(app).post('/combo/500').expect('band-pass').expect(500);
          await test(app).post('/combo/501').expect('band-pass').expect(501);
          await test(app).post('/combo/504').expect('band-pass').expect(504);
          await test(app).post('/combo/506').expect('band-pass').expect(506);
          await test(app).post('/combo/510').expect('band-pass').expect(510);
          await test(app).post('/combo/201').expect('band-pass').expect(201);
          await test(app).post('/combo/200').expect(200);
        });

        it('allows the "*" to represent all status codes', async () => {
          const r = new KoaJoiRouter();

          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/all',
              validate: {
                output: {
                  '*': { body: Joi.any().equal('all') }
                }
              },
              handler: function (ctx) {
                ctx.status = 201;
                ctx.body = 'all';
              }
            });
          });

          const app = new Koa();
          app.use(r.middleware());
          await test(app).get('/all').expect('all').expect(201);
        });

        describe('throws on invalid pattern', () => {
          const tests = [
            { pattern: '100x' },
            { pattern: 'x100' },
            { pattern: '1,' },
            { pattern: ',1' },
            { pattern: '600' },
            { pattern: '99' },
            { pattern: '100-200-300' },
            { pattern: '100-200-' },
            { pattern: '100-' },
            { pattern: '-100' },
            { pattern: '-100-' },
            { pattern: ',' },
            { pattern: ',,' },
            { pattern: '-' }
          ];

          tests.forEach((test) => {
            it(test.pattern, (done) => {
              const r = new KoaJoiRouter();
              const output = {};
              output[test.pattern] = { body: Joi.string() };

              assert.throws(() => {
                r.route({
                  method: 'get',
                  path: '/invalid',
                  validate: { output: output },
                  handler: () => { }
                });
              });

              done();
            });
          });
        });

        it('throws on non-digit, comma, dash or space', () => {
          const r = new KoaJoiRouter();
          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/invalid',
              validate: {
                output: {
                  '%': { body: Joi.string() }
                }
              },
              handler: () => { }
            });
          });
        });

        it('throws if any status code patterns overlap', () => {
          const r = new KoaJoiRouter();

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/1',
              validate: {
                output: {
                  '200': { body: Joi.any().equal('all') },
                  '200, 201': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /200 <=> 200, 201/);

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/2',
              validate: {
                output: {
                  '400': { body: Joi.any().equal('all') },
                  '200-500': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /400 <=> 200-500/);

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/22',
              validate: {
                output: {
                  '200-500': { body: Joi.any().equal('all') },
                  '404': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /404 <=> 200-500/);

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/3',
              validate: {
                output: {
                  '201, 204-208': { body: Joi.any().equal('all') },
                  '200,204': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /201, 204-208 <=> 200,204/);

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/4',
              validate: {
                output: {
                  '400, 404': { body: Joi.any().equal('all') },
                  '200, 201-203, 206, 301-400': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /400, 404 <=> 200, 201-203, 206, 301-400/);

          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/overlap/5',
              validate: {
                output: {
                  '*': { body: Joi.any().equal('all') },
                  '500': { body: Joi.any().equal('all') }
                }
              },
              handler: (ctx) => {
                ctx.body = 'all';
              }
            });
          }, /500 <=> \*/);
        });

        it('does not throw if status code patterns do not overlap', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/overlap/1',
              validate: {
                output: {
                  '200': { body: Joi.any().equal('all') },
                  '201, 202': { body: Joi.any().equal('all') },
                  '203-599': { body: Joi.any().equal('all') }
                }
              },
              handler: () => { }
            });
          });
        });
      });

      describe('fields', () => {
        it('throws when neither body nor headers is specified', () => {
          const r = new KoaJoiRouter();
          assert.throws(() => {
            r.route({
              method: 'get',
              path: '/',
              validate: {
                output: { '200': {} }
              },
              handler: () => { }
            });
          });
        });

        it('does not throw if headers is specified but not body', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/',
              validate: {
                output: {
                  '200': { headers: { x: Joi.any() } }
                }
              },
              handler: () => { }
            });
          });
        });

        it('does not throw if body is specified but not headers', () => {
          const r = new KoaJoiRouter();
          assert.doesNotThrow(() => {
            r.route({
              method: 'get',
              path: '/',
              validate: {
                output: {
                  '200': { body: { x: Joi.any() } }
                }
              },
              handler: () => { }
            });
          });
        });
      });

      describe('body,', () => {
        describe('when specified,', () => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'post',
            path: '/a/b',
            validate: {
              output: {
                '100-599': { body: { n: Joi.number().max(10).required() } }
              }
            },
            handler: (ctx) => {
              ctx.body = { n: '3' };
            }
          });

          r.route({
            method: 'post',
            path: '/body/missing',
            validate: {
              output: {
                '200': { body: Joi.number().required() }
              }
            },
            handler: (ctx) => {
              ctx.status = 200;
            }
          });

          r.route({
            method: 'post',
            path: '/body/invalid',
            validate: {
              output: {
                '*': {
                  body: Joi.object({
                    y: Joi.string().min(3)
                  })
                }
              }
            },
            handler: (ctx) => {
              ctx.body = {
                x: 'hi',
                y: 'asdf'
              };
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          it('casts output values according to Joi rules', async () => {
            // n should be cast to a number
            await test(app).post('/a/b').expect('{"n":3}').expect(200);
          });

          describe('but not included in response', () => {
            it('responds with a 500', async () => {
              await test(app).post('/body/missing').expect(500);
            });
          });

          describe('when output is invalid', () => {
            it('responds with a 500', async () => {
              await test(app).post('/body/invalid').expect(500);
            });
          });
        });

        describe('when not specified,', () => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'post',
            path: '/notouch',
            handler: (ctx) => {
              ctx.body = { n: '4' };
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          it('is not touched', async () => {
            const o = await test(app).post('/notouch').expect(200);
            assert.strictEqual(o.text, '{"n":"4"}');
          });
        });
      });

      describe('headers', () => {
        const headers = Joi.object({
          n: Joi.string().max(3).required()
        }).options({
          allowUnknown: true
        });

        describe('when specified', () => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'post',
            path: '/headers/cast',
            validate: {
              output: {
                '100-599': {
                  headers: headers
                }
              }
            },
            handler: (ctx) => {
              ctx.set('n', '  3');
              ctx.body = 'RWC';
            }
          });

          r.route({
            method: 'post',
            path: '/headers/missing',
            validate: {
              output: {
                '200': {
                  headers: headers
                }
              }
            },
            handler: (ctx) => {
              ctx.set('nope', 5);
              ctx.body = 'RWC';
            }
          });

          r.route({
            method: 'post',
            path: '/headers/invalid',
            validate: {
              output: {
                '*': {
                  headers: headers
                }
              }
            },
            handler: (ctx) => {
              ctx.set('n', 1000);
              ctx.body = 'RWC';
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          it('casts output values according to Joi rules', async () => {
            await test(app).post('/headers/cast').expect('n', '3').expect(200);
          });

          describe('but not included in response', () => {
            it('responds with a 500', async () => {
              await test(app).post('/headers/missing').expect(500);
            });
          });

          describe('when output is invalid', () => {
            it('responds with a 500', async () => {
              await test(app).post('/headers/invalid').expect(500);
            });
          });
        });

        describe('when not specified', () => {
          const r = new KoaJoiRouter();

          r.route({
            method: 'post',
            path: '/notouch',
            handler: (ctx) => {
              ctx.set('n', '3');
              ctx.body = 'RWC';
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          it('is not touched', async () => {
            const o = await test(app).post('/notouch').expect(200);
            assert.strictEqual(o.header.n, '3');
          });
        });
      });

      it('does not occur when no status code matches', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/notouch',
          validate: {
            output: {
              '510': { body: { n: Joi.string() } }
            }
          },
          handler: (ctx) => {
            ctx.body = { n: 4 };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        const o = await test(app).post('/notouch').expect(200);
        assert.strictEqual(o.text, '{"n":4}');
      });
    });

    describe('with multiple methods', () => {
      describe('and multiple middleware', () => {
        it('works', (done) => {
          async function a(ctx, next) {
            ctx.worked = true;
            await next();
          }

          function b(ctx) {
            ctx.body = {
              worked: !!ctx.worked
            };
          }

          const r = new KoaJoiRouter();
          r.route({
            path: '/',
            method: ['post', 'put'],
            handler: [a, b],
            validate: {
              header:
                Joi.object({ yum: Joi.string().token() })
                  .options({ allowUnknown: true })
            }
          });

          const app = new Koa();
          app.use(r.middleware());

          test(app).put('/').set('yum', '&&').expect(400, (err) => {
            if (err) return done(err);
            test(app).post('/').set('yum', '&&').expect(400, (err) => {
              if (err) return done(err);
              test(app).post('/').set('yum', 'sdfa3_E').expect(200, done);
            });
          });
        });
      });
    });

    describe('methods', () => {
      function makeMethodRouter(method, path) {
        const r = new KoaJoiRouter();
        r[method].apply(r, slice(arguments, 1));
        assert.equal(1, r.routes.length);

        const route = r.routes[0];
        assert.equal(path, route.path);
        assert.equal(method, route.method[0]);

        return r;
      }

      function testMethodRouter(r, expected, done) {
        const route = r.routes[0];
        const method = route.method[0];
        const req = test(makeRouterApp(r))[method](route.path);
        switch (method) {
          case 'connect':
            // CONNECT is used by proxy servers to establish tunnels
            req.end((err) => {
              if (err && err.code === 'ECONNRESET') {
                done();
              } else {
                done(err);
              }
            });
            break;
          case 'head':
            // HEAD must not return a body
            req.expect(undefined, done);
            break;
          default:
            // Otherwise, test the request normally.
            req.expect(expected, done);
        }
      }

      it('exist', (done) => {
        const r = new KoaJoiRouter();
        methods.forEach((method) => {
          assert.equal('function', typeof r[method], 'missing method: ' + method);
        });
        done();
      });

      methods.forEach((method) => {
        describe(method + '()', () => {
          it('supports path and handler', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', m.generate());

            testMethodRouter(r, m.getExpectedBody(), done);
          });

          it('supports path and multiple handlers', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', m.generate(), m.generate());

            testMethodRouter(r, m.getExpectedBody(), done);
          });

          it('supports path and nested handlers', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', [
              m.generate(), [
                m.generate(), [
                  m.generate()
                ]
              ]
            ], m.generate());

            testMethodRouter(r, m.getExpectedBody(), done);
          });

          it('supports path, config and handler', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', {
              meta: true
            }, m.generate());

            assert(r.routes[0].meta);

            testMethodRouter(r, m.getExpectedBody(), done);
          });

          it('supports path, config and multiple handlers', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', {
              meta: true
            }, m.generate(), m.generate());

            assert(r.routes[0].meta);

            testMethodRouter(r, m.getExpectedBody(), done);
          });

          it('supports path, config, and nested handlers', (done) => {
            const m = new MiddlewareGenerator();
            const r = makeMethodRouter(method, '/', {
              meta: true
            }, [
              m.generate(), [
                m.generate(), [
                  m.generate()
                ]
              ]
            ], m.generate());

            assert(r.routes[0].meta);

            testMethodRouter(r, m.getExpectedBody(), done);
          });
        });
      });
    });
  });

  describe('use()', () => {
    describe('applies middleware in the order it was added', () => {
      it('can apply middleware before routes', async () => {
        const r = new KoaJoiRouter();
        let middlewareRanFirst = false;

        r.use(async (ctx, next) => {
          middlewareRanFirst = true;
          await next();
        });

        r.get('/test', (ctx) => {
          ctx.body = String(middlewareRanFirst);
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/test')
          .expect('true')
          .expect(200);
      });

      it('can apply middleware after routes', async () => {
        const r = new KoaJoiRouter();
        let middlewareRanFirst = false;

        r.get('/test', (ctx) => {
          ctx.body = String(middlewareRanFirst);
        });

        r.use(async (ctx, next) => {
          middlewareRanFirst = true;
          await next();
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/test')
          .expect('false')
          .expect(200);
      });
    });

    describe('accepts an optional path', () => {
      it('which applies middleware only to that path', async () => {
        const r = new KoaJoiRouter();
        let middlewareRan = false;

        r.use('/nada', async (ctx, next) => {
          middlewareRan = true;
          await next();
        });

        function route(ctx) {
          ctx.body = String(middlewareRan);
        }

        r.get('/nada', route);
        r.get('/test', route);

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/test')
          .expect('false')
          .expect(200);

        await test(app).get('/nada')
          .expect('true')
          .expect(200);
      });
    });
  });

  describe('prefix()', () => {
    it('adds routes as children of the `path`', async () => {
      const app = new Koa();
      app.context.msg = 'fail';

      const r = new KoaJoiRouter();

      r.use(async (ctx, next) => {
        ctx.msg = 'works';
        await next();
      });

      r.get('/', (ctx) => {
        ctx.body = ctx.msg;
      });

      r.get('/itworks', (ctx) => {
        ctx.body = 'it' + ctx.msg;
      });

      r.get('/testparam/:id', {
        validate: { params: { id: Joi.string().min(4) } }
      }, (ctx) => {
        ctx.body = `it${ctx.msg}${ctx.params.id}`;
      });

      r.prefix('/user');

      app.use(r.middleware());

      await test(app).get('/')
        .expect(404);

      await test(app).get('/user')
        .expect('works')
        .expect(200);

      await test(app).get('/user/')
        .expect('works')
        .expect(200);

      await test(app).get('/user/itworks')
        .expect('itworks')
        .expect(200);

      await test(app).get('/user/itworks/')
        .expect('itworks')
        .expect(200);

      await test(app).get('/user/testparam/dude')
        .expect('itworksdude')
        .expect(200);
    });
  });

  describe('param()', () => {
    it('defines middleware for named route params', async () => {
      const app = new Koa();
      const r = new KoaJoiRouter();
      const users = { '2': 'aaron' };

      r.param('user', async (id, ctx, next) => {
        // eslint-disable-next-line no-undef
        ctx.user = await Promise.resolve(users[id]);

        if (!ctx.user) {
          ctx.status = 404;
          return;
        }

        await next();
      });

      r.get('/user/:user', (ctx) => {
        ctx.body = `hello ${ctx.user}`;
      });

      app.use(r.middleware());

      await test(app).get('/user/1')
        .expect(404);

      await test(app).get('/user/2')
        .expect('hello aaron')
        .expect(200);
    });

  });

  describe('@fastify/busboy v3', () => {
    describe('multipart without boundary', () => {
      it('returns an error when Content-Type has no boundary', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: { type: 'multipart' },
          handler: (ctx) => {
            ctx.status = 200;
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app)
          .post('/')
          .set('Content-Type', 'multipart/form-data')
          .send('no boundary here')
          .expect((res) => {
            assert(res.status >= 400, 'expected error status, got ' + res.status);
          })
          .end(done);
      });

      it('captures error with continueOnError when boundary is missing', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: {
            type: 'multipart',
            continueOnError: true
          },
          handler: (ctx) => {
            ctx.status = ctx.invalid ? 200 : 500;
            ctx.body = ctx.invalid ? 'caught' : 'missed';
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app)
          .post('/')
          .set('Content-Type', 'multipart/form-data')
          .send('no boundary here')
          .expect(200)
          .expect('caught', done);
      });
    });

    describe('multipartOptions.limits', () => {
      it('rejects with 413 when fields limit is exceeded', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: {
            type: 'multipart',
            multipartOptions: {
              limits: { fields: 1 }
            }
          },
          handler: async (ctx) => {
            let part;
            while ((part = await ctx.request.parts)) {
              if (part.resume) part.resume();
            }
            ctx.status = 200;
            ctx.body = 'ok';
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app)
          .post('/')
          .field('a', '1')
          .field('b', '2')
          .field('c', '3')
          .expect(413, done);
      });

      it('rejects with 413 when files limit is exceeded', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: {
            type: 'multipart',
            multipartOptions: {
              limits: { files: 1 }
            }
          },
          handler: async (ctx) => {
            let part;
            while ((part = await ctx.request.parts)) {
              if (part.resume) part.resume();
            }
            ctx.status = 200;
            ctx.body = 'ok';
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        const b = Buffer.alloc(64);
        b.fill('x');

        test(app)
          .post('/')
          .attach('file1', b)
          .attach('file2', b)
          .expect(413, done);
      });

      it('succeeds when within limits', (done) => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'post',
          path: '/',
          validate: {
            type: 'multipart',
            multipartOptions: {
              limits: { fields: 5, files: 3 }
            }
          },
          handler: async (ctx) => {
            let part;
            while ((part = await ctx.request.parts)) {
              if (part.resume) part.resume();
            }
            ctx.status = 200;
            ctx.body = { color: ctx.request.parts.field.color };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        test(app)
          .post('/')
          .field('color', 'blue')
          .attach('file1', `${__dirname}/fixtures/koa.png`)
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.color, 'blue');
          })
          .end(done);
      });
    });
  });

  describe('@koa/router v15 (path-to-regexp v8)', () => {
    describe('named params with delimiters', () => {
      it('supports dash-separated named params', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/range/:from-:to',
          validate: {
            params: Joi.object({
              from: Joi.number().integer().required(),
              to: Joi.number().integer().required()
            })
          },
          handler: (ctx) => {
            ctx.body = {
              from: ctx.request.params.from,
              to: ctx.request.params.to
            };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/range/1-100')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.from, 1);
            assert.equal(res.body.to, 100);
          });

        await test(app).get('/range/abc-100')
          .expect(400);
      });

      it('supports dot-separated named params', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/file/:name.:ext',
          handler: (ctx) => {
            ctx.body = {
              name: ctx.params.name,
              ext: ctx.params.ext
            };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/file/report.pdf')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.name, 'report');
            assert.equal(res.body.ext, 'pdf');
          });
      });
    });

    describe('optional path segments', () => {
      it('matches with and without the optional segment', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/items{/:id}',
          handler: (ctx) => {
            ctx.body = {
              id: ctx.params.id || null
            };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/items')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.id, null);
          });

        await test(app).get('/items/42')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.id, '42');
          });
      });

      it('validates optional params with Joi when present', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/things{/:id}',
          validate: {
            params: Joi.object({
              id: Joi.number().integer().min(1).optional()
            })
          },
          handler: (ctx) => {
            ctx.body = { id: ctx.request.params.id || null };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/things')
          .expect(200);

        await test(app).get('/things/5')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.id, 5);
          });

        await test(app).get('/things/0')
          .expect(400);
      });
    });

    describe('trailing slash handling', () => {
      it('matches routes with or without trailing slash by default', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/api/data',
          handler: (ctx) => {
            ctx.body = 'ok';
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/api/data')
          .expect(200)
          .expect('ok');

        await test(app).get('/api/data/')
          .expect(200)
          .expect('ok');
      });
    });

    describe('middleware path boundary matching', () => {
      it('scoped middleware does not leak to similar path prefixes', async () => {
        const r = new KoaJoiRouter();
        let scopedRan = false;

        r.use('/admin', async (ctx, next) => {
          scopedRan = true;
          await next();
        });

        r.get('/admin', (ctx) => {
          ctx.body = { scopedRan };
        });

        r.get('/admin-panel', (ctx) => {
          ctx.body = { scopedRan };
        });

        const app = new Koa();
        app.use(r.middleware());

        scopedRan = false;
        await test(app).get('/admin')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.scopedRan, true);
          });

        scopedRan = false;
        await test(app).get('/admin-panel')
          .expect(200)
          .expect((res) => {
            assert.equal(res.body.scopedRan, false);
          });
      });
    });

    describe('param validation replaces regex captures', () => {
      it('validates numeric params via Joi instead of path regex', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/user/:id',
          validate: {
            params: Joi.object({
              id: Joi.number().integer().positive().required()
            })
          },
          handler: (ctx) => {
            ctx.body = { id: ctx.request.params.id };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/user/42')
          .expect(200)
          .expect((res) => {
            assert.strictEqual(res.body.id, 42);
          });

        await test(app).get('/user/abc')
          .expect(400);

        await test(app).get('/user/-1')
          .expect(400);
      });

      it('validates UUID-like params via Joi', async () => {
        const r = new KoaJoiRouter();

        r.route({
          method: 'get',
          path: '/resource/:uuid',
          validate: {
            params: Joi.object({
              uuid: Joi.string().guid({ version: 'uuidv4' }).required()
            })
          },
          handler: (ctx) => {
            ctx.body = { uuid: ctx.request.params.uuid };
          }
        });

        const app = new Koa();
        app.use(r.middleware());

        await test(app).get('/resource/550e8400-e29b-41d4-a716-446655440000')
          .expect(200);

        await test(app).get('/resource/not-a-uuid')
          .expect(400);
      });
    });
  });

  describe('Koa v3 compatibility', () => {
    it('async handlers work without generators', async () => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'get',
        path: '/async-test',
        handler: async (ctx) => {
          const value = await Promise.resolve('async-works');
          ctx.body = value;
        }
      });

      const app = new Koa();
      app.use(r.middleware());

      await test(app).get('/async-test')
        .expect(200)
        .expect('async-works');
    });

    it('ctx.throw works correctly in async context', async () => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'get',
        path: '/throw-test',
        handler: async (ctx) => {
          ctx.throw(422, 'Unprocessable');
        }
      });

      const app = new Koa();
      app.use(r.middleware());

      await test(app).get('/throw-test')
        .expect(422);
    });

    it('multiple async middleware chain correctly', async () => {
      const r = new KoaJoiRouter();

      r.route({
        method: 'get',
        path: '/chain',
        handler: [
          async (ctx, next) => {
            ctx.state.order = ['first'];
            await next();
            ctx.state.order.push('first-after');
            ctx.body = ctx.state.order.join(',');
          },
          async (ctx, next) => {
            ctx.state.order.push('second');
            await next();
          },
          async (ctx) => {
            ctx.state.order.push('third');
          }
        ]
      });

      const app = new Koa();
      app.use(r.middleware());

      await test(app).get('/chain')
        .expect(200)
        .expect('first,second,third,first-after');
    });
  });
});
