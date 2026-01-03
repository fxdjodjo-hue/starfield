import { describe, it, expect } from 'vitest';
import { Component } from '../../../infrastructure/ecs/Component';

// Test component implementation
class TestComponent extends Component {
  public value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }
}

describe('Component', () => {
  it('should be instantiable', () => {
    const component = new TestComponent('test');
    expect(component).toBeInstanceOf(Component);
    expect(component.value).toBe('test');
  });

  it('should be a marker class', () => {
    const component = new TestComponent('test');
    expect(component).toBeDefined();
    expect(typeof component).toBe('object');
  });
});
