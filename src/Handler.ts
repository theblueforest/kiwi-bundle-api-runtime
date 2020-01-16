import { Context, ContextMethod } from "./Context"

export type HandlerConfig<Params = any, Body = any> = (context: Context<Params>) => {
  [method in ContextMethod]?: Promise<Body | void>
}

export const Handler = <Params = {}, Body = {}>(config: HandlerConfig<Params, Body>) => {
  return (context: Context<Params, Body>) => {
    return config(context)[context.method]
  }
}
