import * as http from "http"
import { Readable } from "stream"
import { parse } from "url"

export type ContextMethod = "GET"|"HEAD"|"POST"|"PUT"|"DELETE"|"CONNECT"|"OPTIONS"|"TRACE"|"PATCH"

type ContextAddListener = (event: string | symbol, listener: (...args: any[]) => void) => Readable

export class Context<RequestHeaders extends ({ [name: string]: string } & { "content-type"?: string }) = any, RequestQuery extends { [name: string]: string } = any, RequestParams extends { [name: string]: string } = any, ResponseHeaders extends { [name: string]: string } = any, ResponseBody = any> {
  readonly method: ContextMethod
  readonly url: string
  readonly headers: RequestHeaders
  readonly query: RequestQuery
  private addListener: ContextAddListener
  handler: { path?: string, params?: RequestParams } = {}
  response: { code?: number, headers?: ResponseHeaders, body?: ResponseBody } = {}

  constructor(request: http.IncomingMessage) {
    const url = parse(request.url as string, true)
    this.method = request.method as ContextMethod
    this.url = url.pathname || "/"
    this.headers = request.headers as RequestHeaders
    this.query = Object.assign({}, url.query) as RequestQuery
    this.addListener = request.on.bind(request)
  }

  private parseBody(body: string, contentType?: string) {
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
          resolve(this.parseBody(body, this.headers["content-type"]))
        })
      }
    })
  }

  toJSON() {
    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      query: this.query,
      handler: this.handler,
      response: {
        code: this.response.code,
        headers: this.response.headers,
      },
    }
  }

}
