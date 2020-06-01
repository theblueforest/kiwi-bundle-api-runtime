import { Context, ContextMethod } from "./Context"
import * as DROPin from "dropin-recipes"
import { NameField } from "dropin-recipes"

type OptionsParams = { name?: string }

interface HandlerOptions<Data extends HandlerOptions<Data>> {
  requestHeaders?: DROPin.KeysObject<OptionsParams, Data["requestHeaders"]>
  query?: DROPin.KeysObject<OptionsParams, Data["query"]>
  params?: DROPin.KeysObject<OptionsParams, Data["params"]>
  responseHeaders?: DROPin.KeysObject<OptionsParams, Data["responseHeaders"]>
}

type ContextType<ResponseBody = any, Options extends HandlerOptions<Options> = any> = Context<
  { [name in keyof Options["requestHeaders"]]: string },
  { [name in keyof Options["query"]]: string },
  { [name in keyof Options["params"]]: string },
  { [name in keyof Options["responseHeaders"]]: string },
  ResponseBody
>

export const Handler = <ResponseBody = any, Options extends HandlerOptions<Options> = any>(options: Options, execute: (context: ContextType<ResponseBody, Options>, options: Options) => { [method in ContextMethod]?: (Promise<ResponseBody | void> | (() => Promise<ResponseBody | void>)) }) => {
  return (context: ContextType<ResponseBody, Options>) => {
    const output = execute(context, options)[context.method]
    if(typeof output === "function") return output()
    return output
  }
}

/*interface HandlerOptions<ResponseBody> {
  name?: NameField
  http?: {
    [method in ContextMethod]?: {
      name?: NameField
      run: (context: Context) => Promise<ResponseBody | void>
    }
  }
}

export const Handler = <ResponseBody = any>(options: HandlerOptions<ResponseBody>) => {
  return (context: Context): Promise<ResponseBody | void> => {
    if(typeof options.http !== "undefined" && typeof options.http[context.method] !== "undefined") {
      return options.http[context.method].run(context)
    }
    return Promise.resolve()
  }
}*/
