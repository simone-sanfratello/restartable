'use strict'

const Fastify = require('fastify')
const buildServer = require('./lib/server')

async function start (opts) {
  const serverWrapper = buildServer(opts)

  let listening = false
  const res = {
    app: await (spinUpFastify(opts, serverWrapper, restart).ready()),
    restart,
    get address () {
      if (!listening) {
        throw new Error('Server is not listening')
      }
      return serverWrapper.address
    },
    get port () {
      if (!listening) {
        throw new Error('Server is not listening')
      }
      return serverWrapper.port
    },
    inject (...args) {
      return res.app.inject(...args)
    },
    async listen () {
      await serverWrapper.listen()
      listening = true
      return {
        address: serverWrapper.address,
        port: serverWrapper.port
      }
    },
    stop
  }

  res.app.server.on('request', res.app.server.handler)

  return res

  async function restart () {
    const old = res.app
    const oldHandler = serverWrapper.server.handler
    const newApp = spinUpFastify(opts, serverWrapper, restart)
    await newApp.ready()
    old.server.removeListener('request', oldHandler)
    newApp.server.on('request', newApp.server.handler)
    res.app = newApp
    await old.close()
  }

  async function stop () {
    const toClose = []
    if (listening) {
      toClose.push(serverWrapper.close())
    }
    toClose.push(res.app.close())
    await Promise.all(toClose)
  }
}

function spinUpFastify (opts, serverWrapper, restart) {
  const server = serverWrapper.server
  const _opts = Object.assign({}, opts)
  _opts.serverFactory = function (handler) {
    server.handler = handler
    return server
  }
  const app = Fastify(_opts)

  app.decorate('restart', restart)

  app.register(opts.app, opts)

  return app
}

module.exports = {
  start
}
