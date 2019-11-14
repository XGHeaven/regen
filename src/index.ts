import { ReactNode, Component, ComponentClass, ReactElement, ClassType } from "react";

const component: RegenComponent<{}, {name: string}> = function *({props, handler}) {
  return null as any
}

export type RegenComponent<P = {}, H = {}> = (ctx: RegenContext<P, H>) => Generator<ReactNode, unknown, P | null>

export type RegenContext<P, H = {}> = {
  props: P,
  handler: H,
  mark: () => void,
  afterRender: (fn: RegenCallback, deps?: RegenCallbackDeps) => void,
  afterLayout: (fn: RegenCallback, deps?: RegenCallbackDeps) => void,
  afterMount: (fn: RegenCallback) => void,
  afterUpdate: (fn: RegenCallback) => void,
  inject: () => void,
  provide: () => void,
}

export type RegenCallbackDeps = () => Array<any>

export type RegenCallback = () => any

export type RegenCallbackType = {
  fn: () => unknown,
  deps?: RegenCallbackDeps,
  memDeps?: any[]
}

const PropsAgentHandlers: ProxyHandler<Component> = {
  get(target, name){ Reflect.get(target.props, name) },
  set() { throw new Error('Cannot set props') },
  ownKeys(target) { return Reflect.ownKeys(target.props)},
  getPrototypeOf(target) { return Reflect.getPrototypeOf(target.props)},
  getOwnPropertyDescriptor(target, name) { return Reflect.getOwnPropertyDescriptor(target.props, name)},
}

export function regen<P = {}, H = {}>(Cmp: RegenComponent<P, H>): ClassType<P, Component<P, any> & H, ComponentClass<P>> {
  class RegenedComponent extends Component<P, {count: number}> {
    static displayName = `${Cmp.name}(Regen)`
    state = {
      count: 1
    }
    private propsAgent: P = new Proxy(this, PropsAgentHandlers) as any
    private ref: H = new Proxy(this, {}) as any
    private ctx: RegenContext<P, H> = {
      props: this.props,
      handler: this.ref,
      mark: () => this.setState(({count}) => ({count: count + 1})),
      afterLayout: (fn, deps) => {
        this._$cbs.push({
          fn,
          deps: deps
        })
      },
      afterRender: () => {},
      afterMount: (fn) => {
        this.ctx.afterRender(fn, () => ([]))
      },
      afterUpdate: (fn) => {
        // this.ctx.afterRender(fn, () => ([!!this.state.count]))
      },
      inject: () => {},
      provide: () => {},
    }
    private inst = Cmp(this.ctx)
    private _$cbs: Array<RegenCallbackType> = []

    componentWillUnmount() {
      this.inst.next(null)
    }

    render() {
      const ret = this.inst.next(this.propsAgent)
      // TODO: check ret.done
      return ret.value as ReactElement
    }
  }

  return RegenedComponent as any
}
