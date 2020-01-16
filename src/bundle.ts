import { API } from "./API"

export function KiwiBundleAPI(path: string, handlers: { [path: string]: string }) {
  const api = new API(path)
  api.setHandlers(handlers)
  api.start()
}
