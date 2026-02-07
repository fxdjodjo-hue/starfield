/**
 * DOMEventManager - Sistema centralizzato per gestione eventi DOM
 * Unifica gestione eventi UI (click, mouseenter, mouseleave, etc.)
 */

import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { CollectionManager } from '../data/CollectionManager';

export interface EventHandler {
  element: HTMLElement | Window | Document;
  eventType: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export interface EventStats {
  registeredHandlers: number;
  activeElements: number;
  eventTypes: string[];
  memoryUsage: number;
}

export class DOMEventManager {
  private static eventHandlers: Map<string, EventHandler> = new Map();
  private static eventStats = {
    registeredHandlers: 0,
    activeElements: 0,
    eventTypes: new Set<string>()
  };

  /**
   * Registra un event handler con gestione automatica del cleanup
   */
  static addEventHandler(
    element: HTMLElement | Window | Document,
    eventType: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions,
    context?: string
  ): string {
    try {
      // Genera ID univoco per l'handler
      const handlerId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Registra l'evento
      element.addEventListener(eventType, handler, options);

      // Salva riferimento per cleanup
      const eventHandler: EventHandler = {
        element,
        eventType,
        handler,
        options
      };

      CollectionManager.set(this.eventHandlers, handlerId, eventHandler);

      // Aggiorna statistiche
      this.eventStats.registeredHandlers++;
      this.eventStats.eventTypes.add(eventType);
      this.updateActiveElementsCount();

      LoggerWrapper.debug(LogCategory.SYSTEM, `DOM event handler registered: ${eventType}`, {
        handlerId: handlerId,
        eventType: eventType,
        elementTag: element instanceof HTMLElement ? element.tagName.toLowerCase() : 'window/document',
        context: context || 'unknown'
      });

      return handlerId;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to add DOM event handler', error as Error, {
        eventType: eventType,
        elementType: element.constructor.name,
        context: context
      });
      throw error;
    }
  }

  /**
   * Rimuove un event handler specifico
   */
  static removeEventHandler(handlerId: string): boolean {
    try {
      const eventHandler = CollectionManager.get(this.eventHandlers, handlerId);
      if (!eventHandler) {
        LoggerWrapper.warn(LogCategory.SYSTEM, `DOM event handler not found: ${handlerId}`, {
          handlerId: handlerId
        });
        return false;
      }

      // Rimuovi l'event listener
      eventHandler.element.removeEventListener(
        eventHandler.eventType,
        eventHandler.handler,
        eventHandler.options
      );

      // Rimuovi dalla collezione
      CollectionManager.delete(this.eventHandlers, handlerId);

      // Aggiorna statistiche
      this.eventStats.registeredHandlers--;
      this.updateActiveElementsCount();

      LoggerWrapper.debug(LogCategory.SYSTEM, `DOM event handler removed: ${eventHandler.eventType}`, {
        handlerId: handlerId,
        eventType: eventHandler.eventType
      });

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to remove DOM event handler', error as Error, {
        handlerId: handlerId
      });
      return false;
    }
  }

  /**
   * Rimuove tutti gli event handler per un elemento specifico
   */
  static removeElementHandlers(element: HTMLElement | Window | Document): number {
    try {
      const handlersToRemove: string[] = [];
      const elementType = element.constructor.name;

      // Trova tutti gli handler per questo elemento
      for (const [handlerId, eventHandler] of this.eventHandlers.entries()) {
        if (eventHandler.element === element) {
          handlersToRemove.push(handlerId);
        }
      }

      // Rimuovi tutti gli handler trovati
      let removedCount = 0;
      for (const handlerId of handlersToRemove) {
        if (this.removeEventHandler(handlerId)) {
          removedCount++;
        }
      }

      LoggerWrapper.debug(LogCategory.SYSTEM, `Removed ${removedCount} DOM event handlers for element`, {
        elementType: elementType,
        removedCount: removedCount
      });

      return removedCount;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to remove element handlers', error as Error, {
        elementType: element.constructor.name
      });
      return 0;
    }
  }

  /**
   * Metodo helper per aggiungere click handler
   */
  static addClickHandler(
    element: HTMLElement,
    handler: (event: MouseEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'click', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere mouseenter handler
   */
  static addMouseEnterHandler(
    element: HTMLElement,
    handler: (event: MouseEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'mouseenter', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere mouseleave handler
   */
  static addMouseLeaveHandler(
    element: HTMLElement,
    handler: (event: MouseEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'mouseleave', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere keyboard handler
   */
  static addKeyDownHandler(
    element: HTMLElement | Window | Document,
    handler: (event: KeyboardEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'keydown', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere keyup handler
   */
  static addKeyUpHandler(
    element: HTMLElement | Window | Document,
    handler: (event: KeyboardEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'keyup', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere input handler (per form inputs)
   */
  static addInputHandler(
    element: HTMLInputElement | HTMLTextAreaElement,
    handler: (event: Event) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'input', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere change handler (per select, checkbox, etc.)
   */
  static addChangeHandler(
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    handler: (event: Event) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'change', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere submit handler (per forms)
   */
  static addSubmitHandler(
    form: HTMLFormElement,
    handler: (event: Event) => void,
    context?: string
  ): string {
    return this.addEventHandler(form, 'submit', (event) => {
      event.preventDefault(); // Previene il comportamento di default
      handler(event);
    }, false, context);
  }

  /**
   * Metodo helper per aggiungere resize handler
   */
  static addResizeHandler(
    element: HTMLElement | Window,
    handler: (event: Event) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'resize', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere scroll handler
   */
  static addScrollHandler(
    element: HTMLElement | Window,
    handler: (event: Event) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'scroll', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere focus/blur handlers
   */
  static addFocusHandler(
    element: HTMLElement,
    handler: (event: FocusEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'focus', handler as EventListener, false, context);
  }

  static addBlurHandler(
    element: HTMLElement,
    handler: (event: FocusEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'blur', handler as EventListener, false, context);
  }

  /**
   * Metodo helper per aggiungere context menu handler (tasto destro)
   */
  static addContextMenuHandler(
    element: HTMLElement,
    handler: (event: MouseEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'contextmenu', (event) => {
      event.preventDefault(); // Previene il menu contestuale di default
      handler(event as MouseEvent);
    }, false, context);
  }

  /**
   * Metodo helper per aggiungere wheel handler (scroll mouse)
   */
  static addWheelHandler(
    element: HTMLElement,
    handler: (event: WheelEvent) => void,
    context?: string
  ): string {
    return this.addEventHandler(element, 'wheel', handler as EventListener, { passive: false }, context);
  }

  /**
   * Rimuove tutti gli event handler (per cleanup completo)
   */
  static removeAllHandlers(): number {
    try {
      const handlerIds = CollectionManager.getKeys(this.eventHandlers);
      let removedCount = 0;

      for (const handlerId of handlerIds) {
        if (this.removeEventHandler(handlerId)) {
          removedCount++;
        }
      }

      LoggerWrapper.system(`Removed all DOM event handlers: ${removedCount}`, {
        removedCount: removedCount
      });

      return removedCount;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to remove all DOM event handlers', error as Error);
      return 0;
    }
  }

  /**
   * Aggiorna il conteggio degli elementi attivi
   */
  private static updateActiveElementsCount(): void {
    try {
      const activeElements = new Set<HTMLElement | Window | Document>();
      for (const eventHandler of this.eventHandlers.values()) {
        activeElements.add(eventHandler.element);
      }
      this.eventStats.activeElements = activeElements.size;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to update active elements count', error as Error);
      this.eventStats.activeElements = 0;
    }
  }

  /**
   * Ottiene statistiche degli event handler
   */
  static getStats(): EventStats {
    return {
      registeredHandlers: this.eventStats.registeredHandlers,
      activeElements: this.eventStats.activeElements,
      eventTypes: Array.from(this.eventStats.eventTypes),
      memoryUsage: this.eventHandlers.size * 100 // Stima approssimativa
    };
  }

  /**
   * Ottiene tutti gli handler per un tipo di evento specifico
   */
  static getHandlersByType(eventType: string): EventHandler[] {
    const handlers: EventHandler[] = [];
    for (const eventHandler of this.eventHandlers.values()) {
      if (eventHandler.eventType === eventType) {
        handlers.push(eventHandler);
      }
    }
    return handlers;
  }

  /**
   * Verifica se un elemento ha handler registrati
   */
  static hasHandlersForElement(element: HTMLElement | Window | Document): boolean {
    for (const eventHandler of this.eventHandlers.values()) {
      if (eventHandler.element === element) {
        return true;
      }
    }
    return false;
  }
}