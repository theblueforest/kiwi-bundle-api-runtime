import http from "http"
import { join } from "path"
import * as vm from "vm"
import { Context } from "./Context"

export type APIHandlers = {
  [path: string]: {
    path: string
    params: string[]
  }
}

export class API {
  private path: string
  private handlers: APIHandlers = {}

  constructor(path: string) {
    this.path = path
  }

  setHandlers(handlers: { [path: string]: string }) {
    this.handlers = Object.keys(handlers).reduce((result, handlerPath) => {
      let regexPath = handlerPath.replace(/\{.*?\}/g, "([A-Za-z0-9]+)")
      regexPath += regexPath.charAt(regexPath.length - 1) === "/" ? "?" : "/?"
      result["^" + regexPath + "$"] = {
        path: handlers[handlerPath],
        params: handlerPath.match(/\{.*?\}/g)?.map(c => c.slice(1, -1)) || [],
      }
      return result
    }, {} as APIHandlers)
  }

  private getDateString() {
    const now = new Date()
    return now.getFullYear()
    + "/" + ("0" + (now.getMonth() + 1)).slice(-2)
    + "/" + ("0" + now.getDate()).slice(-2)
    + " " + ("0" + now.getHours()).slice(-2)
    + ":" + ("0" + now.getMinutes()).slice(-2)
    + ":" + ("0" + now.getSeconds()).slice(-2)
    + "." + ("0" + now.getMilliseconds()).slice(-2)
  }

  private requestListener(request: http.IncomingMessage, response: http.ServerResponse) {
    const start = Date.now()

    const context = new Context(request)
    console.log(`\n[${this.getDateString()}] ==> Incoming request from ${context.url}`)

    const paths = Object.keys(this.handlers)
    for(let i = 0; i < paths.length; i++) {
      const handlerRegex = new RegExp(paths[i]).exec(context.url)
      if(handlerRegex !== null) {
        const handler = this.handlers[paths[i]]
        context.path = handler.path
        context.params = handler.params.reduce((result, key, index) => {
          result[key] = handlerRegex[index + 1]
          return result
        }, {} as any)
        break
      }
    }

    Promise.resolve(new Promise(resolve => {
      if(typeof context.path === "undefined") {
        resolve()
      } else {
        import(join(this.path, context.path))
          .catch(() => {
            console.log(`\n/!\\ Handler "${context.path}" not found`)
            resolve()
          })
          .then(handler => {
            if(typeof handler.default === "undefined") {
              console.log(`\n/!\\ No default export on handler "${context.path}"`)
              resolve()
            } else if(typeof handler.default !== "function") {
              console.log(`\n/!\\ Default export on handler "${context.path}" is not a function`)
              resolve()
            } else {
              const sandbox = vm.createContext({ handler, context })
              const output: Promise<Context> = vm.runInContext(`handler.default(context)`, sandbox)
              if(typeof output === "undefined") {
                resolve()
              } else {
                output.then(body => {
                  context.body = body
                  resolve()
                }).catch(error => {
                  console.error("\n[ERROR]", error)
                  context.code = 500
                  context.body = "500 - Server error"
                  resolve()
                })
              }
            }
          })
      }
    })).finally(() => {
      if(typeof context.body === "undefined") {
        context.code = 404
        context.body = "404 - Not found"
      }

      const isString = typeof context.body === "string"

      response.writeHead(context.code, Object.assign({
        "Content-Type": isString ? "text/plain" : "application/json",
      }, context.responseHeaders))

      response.write(isString ? context.body : JSON.stringify(context.body, (key, value) => {
        if(typeof value === "function") return
        if(typeof value === "object" && value !== null && value.constructor.name !== "Object") {
          if(typeof value.toJSON === "function") return value.toJSON()
          return
        }
        return value // Types : bigint, boolean, number, object, string, symbol, undefined
      }))

      response.end()

      console.log(`\n[${this.getDateString()}] <== Outgoing response for ${context.url}`)
      if(typeof context.path !== "undefined") console.log(`Path : ${context.path}`)
      console.log(`Code : ${context.code}`)
      console.log(`Time : ${Date.now() - start}ms`)
    })
  }

  start(port = 8080, hostname = "0.0.0.0", callback?: () => void) {
    http.createServer(this.requestListener.bind(this)).listen(port, hostname, () => {
      if(typeof callback === "undefined") {
        console.log(`\nServer available on http://${hostname}:${port}/`)
      } else {
        callback()
      }
    })
  }
}
