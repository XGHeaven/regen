import React, { Component } from 'react'
import { shallow, render, mount } from 'enzyme'
import { regen } from './index'

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
})
