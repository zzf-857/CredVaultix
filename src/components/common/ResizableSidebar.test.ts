import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ResizableSidebar from './ResizableSidebar'

describe('ResizableSidebar', () => {
  it('renders sidebar content and a collapse control', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ResizableSidebar,
        {
          width: 260,
          collapsed: false,
          onWidthChange: () => undefined,
          onCollapsedChange: () => undefined,
          children: React.createElement('span', null, '侧栏内容'),
        }
      )
    )

    expect(html).toContain('侧栏内容')
    expect(html).toContain('折叠侧边栏')
  })
})
