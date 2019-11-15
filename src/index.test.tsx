import React, { Component } from 'react'
import { shallow, render, mount } from 'enzyme'
import { regen, waitTick } from './index'
import { injectable } from 'inversify'

describe('regen', () => {
  it('should works when no props passed', () => {
    const App = regen<{}>(function *() {
      yield <div>Hello World</div>
    })

    const wrapper = render(<App />)
    expect(wrapper.text()).toContain('Hello World')
  })

  it('should works when pass props', () => {
    const Row = regen<{id: string}>(function *Row({props}) {
      yield <p>{props.id}</p>
    })
    const wrapper = mount(<Row id="1"/>)
    expect(wrapper).toContainReact(<p>1</p>)
    wrapper.unmount()
  })

  it('should continual yield view when rerender', () => {
    let count = 0
    const App = regen<{}>(function *App() {
      while (true) {
        count++
        if (yield (
          <p>{count}</p>
        )) {}else break
      }
    })

    const wrapper = shallow(<App/>)
    expect(wrapper).toContainReact(<p>{1}</p>)
    wrapper.instance().forceUpdate()
    expect(wrapper).toContainReact(<p>{2}</p>)
  })

  it('should get null as next value when will unmounted', () => {
    let unmounted = false
    const App = regen<{}>(function *App() {
      while (true) {
        if (yield <p/>) {

        } else {
          unmounted = true
          break
        }
      }
    })

    const wrapper = mount(<App/>)
    expect(unmounted).toBeFalsy()
    wrapper.unmount()
    expect(unmounted).toBeTruthy()
  })

  it('should works when using withRender', () => {
    const App = regen<{name: string}>(function *App({props, withRender}) {
      yield * withRender(() => (<p>{props.name}</p>))
    })
    const wrapper = shallow(<App name="Iron Man"/>)
    expect(wrapper).toContainReact(<p>Iron Man</p>)
  })

  it('should update when call mark', async () => {
    const App = regen(function * App({mark, withRender}) {
      let count = 1
      const click = () => {
        count+=1
        mark()
      }
      yield * withRender(() => <p onClick={click}>{count}</p>)
    })

    const wrapper = shallow(<App/>)
    expect(wrapper).toMatchElement(<p>{1}</p>)
    wrapper.find('p').simulate('click')
    expect(wrapper).toMatchElement(<p>{1}</p>)
    await waitTick()
    expect(wrapper).toMatchElement(<p>{2}</p>)
  })

  it('should batch update when call mark', async () => {
    let resolve: Function
    const waiter = new Promise((res, _) => {resolve = res})
    const App = regen(function * App({mark, withRender}) {
      let count = 0
      const asyncHandler = () => {
        mark()
        setTimeout(() => {
          mark()
          mark()
          resolve()
        })
      }

      yield * withRender(() => {
        count += 1;
        return <p onClick={asyncHandler}>{count}</p>
      })
    })

    const wrapper = shallow(<App/>)
    expect(wrapper).toMatchElement(<p>{1}</p>)
    wrapper.find('p').simulate('click')
    await waiter
    await waitTick()
    expect(wrapper.text()).not.toEqual('4')
  })

  it('should inject works', () => {
    @injectable()
    class Store {
      name = 'Jarvis'
    }

    const App = regen(function *App({withRender, provide}) {
      provide(Store)

      yield * withRender(() => <Child/>)
    })

    const Child = regen(function * Child({withRender, inject}) {
      const store = inject(Store)

      yield * withRender(() => <p>{store.name}</p>)
    })

    const wrapper = mount(<App/>)
    expect(wrapper).toContainReact(<p>Jarvis</p>)
  })

  it.only('should custom instance method', () => {
    const focus = jest.fn()
    const App = regen<{}, {
      focus: () => void
    }>(function *App({handler, withRender}) {
      handler.focus = focus
      yield <p>1</p>
    })

    let inst: InstanceType<typeof App> | null
    const wrapper = shallow(<App ref={node => {inst = node as any}}/>)
    inst!?.focus()
    expect(focus).toBeCalled()
  })
})
