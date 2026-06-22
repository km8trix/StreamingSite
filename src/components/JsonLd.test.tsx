import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JsonLd } from './JsonLd'

describe('JsonLd', () => {
  it('emits an application/ld+json script with the serialized data', () => {
    const { container } = render(
      <JsonLd data={{ '@type': 'WebSite', name: 'Senpai' }} />,
    )
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).not.toBeNull()
    expect(JSON.parse(script!.innerHTML)).toEqual({
      '@type': 'WebSite',
      name: 'Senpai',
    })
  })

  it('escapes < so an injected </script> cannot break out of the tag', () => {
    const { container } = render(
      <JsonLd data={{ name: '</script><script>alert(1)</script>' }} />,
    )
    const html = container.querySelector('script')!.innerHTML
    expect(html).not.toContain('</script>')
    expect(html).toContain('\\u003c')
    // Still valid JSON the consumer can parse back to the original string.
    expect(JSON.parse(html).name).toBe('</script><script>alert(1)</script>')
  })
})
