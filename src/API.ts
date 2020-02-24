import * as http from "http"
import { join } from "path"
import * as vm from "vm"
import { Context } from "./Context"

export type APIHandlers = {
  [regex: string]: {
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
      const params: string[] = []
      const regex = handlerPath.split("/").reduce<string>((result, pathElement) => {
        if(pathElement.charAt(0) === "{" && pathElement.charAt(pathElement.length - 1) === "}") {
          params.push(pathElement.slice(1, -1))
          return `${result}([A-Za-z0-9-_]+)\\/`
        }
        return `${result}${pathElement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/`
      }, "^") + "?$"
      result[regex] = { path: handlers[handlerPath], params }
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
        context.handler = {
          path: this.handlers[paths[i]].path,
          params: this.handlers[paths[i]].params.reduce((result, key, index) => {
            result[key] = handlerRegex[index + 1]
            return result
          }, {} as any),
        }
        break
      }
    }

    Promise.resolve(new Promise(resolve => {
      if(typeof context.handler.path === "undefined") {
        resolve()
      } else {
        import(join(this.path, context.handler.path))
          .catch(() => {
            console.log(`\n/!\\ Handler "${context.handler.path}" not found`)
            resolve()
          })
          .then(handler => {
            if(typeof handler.default === "undefined") {
              console.log(`\n/!\\ No default export on handler "${context.handler.path}"`)
              resolve()
            } else if(typeof handler.default !== "function") {
              console.log(`\n/!\\ Default export on handler "${context.handler.path}" is not a function`)
              resolve()
            } else {
              const sandbox = vm.createContext({ handler, context })
              const output: Promise<Context> = vm.runInContext(`handler.default(context)`, sandbox)
              if(typeof output === "undefined") {
                resolve()
              } else {
                output.then(body => {
                  context.response.body = body
                  resolve()
                }).catch(error => {
                  console.error("\n[ERROR]", error)
                  context.response.code = 500
                  context.response.body = "500 - Server error"
                  resolve()
                })
              }
            }
          })
      }
    })).finally(() => {
      if(typeof context.response.body === "undefined") {
        context.response.code = 404
        context.response.body = "404 - Not found"
      }

      const isString = typeof context.response.body === "string"

      response.writeHead(context.response.code, Object.assign({
        "Content-Type": isString ? "text/plain" : "application/json",
      }, context.response.headers))

      response.write(isString ? context.response.body : JSON.stringify(context.response.body, (key, value) => {
        if(typeof value === "function") return {}
        if(typeof value === "object"
          && !Array.isArray(value)
          && value.constructor.name !== "Object"
          && typeof value.toJSON === "function"
        ) {
          return value.toJSON()
        }
        return value // Types : null, bigint, boolean, number, object, string, symbol, undefined
      }))

      response.end()

      console.log(`\n[${this.getDateString()}] <== Outgoing response for ${context.url}`)
      if(typeof context.handler.path !== "undefined") console.log(`Path : ${context.handler.path}`)
      console.log(`Code : ${context.response.code}`)
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
