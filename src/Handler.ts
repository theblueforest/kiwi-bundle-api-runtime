import { Context, ContextMethod } from "./Context"
import * as DROPin from "dropin-recipes"

interface HandlerOptions<Data extends HandlerOptions<Data>> {
  requestHeaders?: DROPin.KeysObject<{ name: string }, Data["requestHeaders"]>
  query?: DROPin.KeysObject<{ name: string }, Data["query"]>
  params?: DROPin.KeysObject<{ name: string }, Data["params"]>
  responseHeaders?: DROPin.KeysObject<{ name: string }, Data["responseHeaders"]>
}

type ContextType<ResponseBody = any, Options extends HandlerOptions<Options> = any> = Context<
  { [name in keyof Options["requestHeaders"]]: string },
  { [name in keyof Options["query"]]: string },
  { [name in keyof Options["params"]]: string },
  { [name in keyof Options["responseHeaders"]]: string },
  ResponseBody
>

export const Handler = <ResponseBody = any, Options extends HandlerOptions<Options> = any>(options: Options, execute: (context: ContextType<ResponseBody, Options>, options: Options) => { [method in ContextMethod]?: Promise<ResponseBody | void> }) => {
  return (context: ContextType<ResponseBody, Options>) => {
    return execute(context, options)[context.method]
  }
}
