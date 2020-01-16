import http from "http"
import { Readable } from "stream"
import { parse } from "url"

export type ContextMethod = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"CONNECT"|"OPTIONS"|"TRACE"|"PATCH"

type ContextAddListener = (event: string | symbol, listener: (...args: any[]) => void) => Readable

export class Context<Params = {}, Body = {}> {
  code: number = 200
  readonly url: string
  readonly method: ContextMethod
  readonly headers: any = {}
  readonly query: any = {}
  private addListener: ContextAddListener
  responseHeaders: any = {}
  path?: string
  params?: Params
  body?: Body

  constructor(request: http.IncomingMessage) {
    const url = parse(request.url as string, true)
    this.url = url.pathname || "/"
    this.method = request.method as ContextMethod
    this.headers = request.headers
    this.query = Object.assign({}, url.query)
    this.addListener = request.on.bind(request)
  }

  private parseBody(contentType: string, body: string) {
    if(typeof contentType !== "undefined") {

      // application/json
      if(contentType === "application/json") {
        return JSON.parse(body)
      }

      // multipart/form-data
      const multipart = "multipart/form-data; boundary="
      if(contentType.slice(0, multipart.length) === multipart) {
        const head = contentType.slice(multipart.length)
        const regex = new RegExp(`${head}\\r\\nContent-Disposition: form-data; name=\\"(.*?)\\"\\r\\n\\r\\n(.*?)\\r\\n`, "g")
        let output: any = {}
        let regexExec = null
        while((regexExec = regex.exec(body)) !== null) {
          output[regexExec[1]] = regexExec[2]
        }
        return output
      }

      // application/x-www-form-urlencoded
      if(contentType === "application/x-www-form-urlencoded") {
        return Object.assign({}, parse("?" + body, true).query)
      }

    }
    return body
  }

  readData(): Promise<string> {
    return new Promise(resolve => {
      let body = ""
      if(typeof this.addListener === "undefined") {
        resolve(body)
      } else {
        this.addListener("data", chunk => {
          body += chunk.toString()
        })
        this.addListener("end", () => {
          resolve(this.parseBody(this.headers["content-type"], body))
        })
      }
    })
  }

  toJSON() {
    return {
      code: this.code,
      url: this.url,
      method: this.method,
      headers: this.headers,
      query: this.query,
      path: this.path,
      params: this.params,
    }
  }

}
