import 'reflect-metadata'
import { ReactNode, Component, ComponentClass, ReactElement, ClassType, createContext, createElement } from "react";
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom'
import { Container, interfaces } from 'inversify'

export type RegenComponent<P = {}, H = {}> = (ctx: RegenContext<P, H>) => Generator<ReactNode, unknown, P | null>

export type RegenContext<P, H = {}> = {
  props: P,
  handler: H,
  mark: () => void,
  afterRender: (fn: RegenCallback, deps?: RegenCallbackDeps) => void,
  afterLayout: (fn: RegenCallback, deps?: RegenCallbackDeps) => void,
  afterMount: (fn: RegenCallback) => void,
  afterUpdate: (fn: RegenCallback) => void,
  withRender: (render: () => ReactNode) => Generator<ReactNode, unknown, P | null>
  inject: {
    <T>(ctr: new (...args: any[]) => T): T
    <T, R>(type: T): R
  },
  provide: {
    (ctr: new (...args: any[]) => any): void
    (id: interfaces.ServiceIdentifier<unknown>, value: any): void
  }
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


let dirtyCmps: Component<any>[] = []
let waitTicks: Array<() => void> = []
let dirtySchedule: any = null
let nextTick: (fn: () => void) => any

if (typeof requestAnimationFrame === 'function') {
  nextTick = requestAnimationFrame
} else if (typeof Promise === 'function') {
  console.log('promise')
  nextTick = (fn) => Promise.resolve().then(fn)
} else {
  nextTick = (fn) => setTimeout(fn, 0)
}

function scheduleUpdateComponent(cmp: Component<any>) {
  dirtyCmps.push(cmp)
  if (!dirtySchedule) {
    dirtySchedule = nextTick(flushDirtyComponent)
  }
}

function flushDirtyComponent() {
  batchedUpdates(() => {
    const cmps = new Set(dirtyCmps.slice())
    for (const cmp of cmps) {
      cmp.forceUpdate()
    }
    dirtyCmps = []
    dirtySchedule = null
  })
  for (const tick of waitTicks) {
    tick()
  }
}

export function waitTick(): Promise<void>
export function waitTick(fn: () => void): void
export function waitTick(fn?: () => void): Promise<void> | void {
  if (fn) {
    waitTicks.push(fn)
    return
  }
  return new Promise((resolve) => waitTicks.push(resolve))
}

function * withRender<P>(render: () => ReactNode): Generator<ReactNode, void, P | null> {
  for (let ret: P | null; ret = yield render();) {}
}

type DIContextType = {
  container: Container | null
}

const DIContext = createContext<DIContextType>({
  container: null
})

export function regen<P = {}, H = {}>(Cmp: RegenComponent<P, H>): ClassType<P, Component<P, any> & H, ComponentClass<P>> {
  class RegenedComponent extends Component<P, {count: number}> {
    static contextType = DIContext
    static displayName = `${Cmp.name}(Regen)`
    state = {
      count: 1
    }
    context!: DIContextType
    private propsAgent: P = new Proxy(this, PropsAgentHandlers) as any
    private ref: H = new Proxy(this, {}) as any
    private ctx: RegenContext<P, H> = {
      props: this.props,
      handler: this.ref,
      mark: () => scheduleUpdateComponent(this),
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
      inject: (type: any) => {
        return this.container.get(type)
      },
      provide: (type: any, func?: any) => {
        if (!func) {
          this.container.bind(type).to(type)
          return
        }
        this.container.bind(type).to(func)
        this.needProvide = true
      },
      withRender
    }
    private inst = Cmp(this.ctx)
    private _$cbs: Array<RegenCallbackType> = []
    // TODO: 性能优化点
    private container = this.context.container ? this.context.container.createChild() : new Container()
    private needProvide = false

    componentWillUnmount() {
      this.inst.next(null)
    }

    render() {
      const ret = this.inst.next(this.propsAgent)
      // TODO: check ret.done
      if (this.needProvide || !this.context.container) {
        return createElement(DIContext.Provider, {value: {container: this.container}}, ret.value as ReactElement)
      }
      return ret.value as ReactElement
    }
  }

  return RegenedComponent as any
}
