import { describe, it, expect } from 'vitest';
import { StartState } from '../../../game/states/StartState';
import { GameContext } from '../../../infrastructure/engine/GameContext';

describe('StartState', () => {
  let canvas: HTMLCanvasElement;
  let gameContainer: HTMLElement;
  let gameContext: GameContext;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    gameContainer = document.createElement('div');
    gameContext = new GameContext(canvas, gameContainer);
  });

  it('should create instance', () => {
    const instance = new StartState(gameContext);
    expect(instance).toBeDefined();
  });

  it('should have enter method', () => {
    const instance = new StartState(gameContext);
    expect(typeof instance.enter).toBe('function');
  });

  it('should have update method', () => {
    const instance = new StartState(gameContext);
    expect(typeof instance.update).toBe('function');
  });

  it('should have render method', () => {
    const instance = new StartState(gameContext);
    expect(typeof instance.render).toBe('function');
  });

});


