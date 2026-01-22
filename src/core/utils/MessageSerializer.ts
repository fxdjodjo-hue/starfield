/**
 * MessageSerializer - Serializzazione messaggi sicura centralizzata
 * Sostituisce JSON.stringify/parse con try/catch ripetuti in tutto il progetto
 */

export interface SerializationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class MessageSerializer {
  /**
   * Serializza un oggetto in JSON string in modo sicuro
   */
  static safeStringify(data: any): SerializationResult<string> {
    try {
      // Rimuovi funzioni e valori non serializzabili
      const cleanData = this.sanitizeForSerialization(data);
      const jsonString = JSON.stringify(cleanData);

      return {
        success: true,
        data: jsonString
      };
    } catch (error) {
      return {
        success: false,
        error: `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Deserializza una JSON string in oggetto in modo sicuro
   */
  static safeParse<T = any>(jsonString: string): SerializationResult<T> {
    try {
      if (typeof jsonString !== 'string') {
        return {
          success: false,
          error: 'Input must be a string'
        };
      }

      const parsed = JSON.parse(jsonString);

      return {
        success: true,
        data: parsed as T
      };
    } catch (error) {
      return {
        success: false,
        error: `Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Serializza e valida un messaggio di rete
   */
  static serializeNetworkMessage(message: any): SerializationResult<string> {
    // Validazione base del messaggio
    if (!message || typeof message !== 'object') {
      return {
        success: false,
        error: 'Message must be a valid object'
      };
    }

    if (!message.type || typeof message.type !== 'string') {
      return {
        success: false,
        error: 'Message must have a valid type field'
      };
    }

    // Rimuovi campi sensibili o non serializzabili
    const sanitizedMessage = this.sanitizeNetworkMessage(message);

    return this.safeStringify(sanitizedMessage);
  }

  /**
   * Deserializza e valida un messaggio di rete
   */
  static parseNetworkMessage<T = any>(jsonString: string): SerializationResult<T> {
    const parseResult = this.safeParse(jsonString);
    if (!parseResult.success) {
      return parseResult;
    }

    const message = parseResult.data;

    // Validazione base del messaggio ricevuto
    if (!message || typeof message !== 'object') {
      return {
        success: false,
        error: 'Received message must be a valid object'
      };
    }

    if (!message.type || typeof message.type !== 'string') {
      return {
        success: false,
        error: 'Received message must have a valid type field'
      };
    }

    return {
      success: true,
      data: message as T
    };
  }

  /**
   * Rimuove valori non serializzabili da un oggetto
   */
  private static sanitizeForSerialization(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'function') {
      return undefined;
    }

    if (typeof obj === 'symbol') {
      return undefined;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForSerialization(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Salta chiavi private e metodi
      if (key.startsWith('_') || typeof value === 'function') {
        continue;
      }

      sanitized[key] = this.sanitizeForSerialization(value);
    }

    return sanitized;
  }

  /**
   * Sanitizza un messaggio di rete rimuovendo campi sensibili
   */
  private static sanitizeNetworkMessage(message: any): any {
    const sanitized = { ...message };

    // Rimuovi campi che non dovrebbero essere inviati
    const sensitiveFields = ['password', 'token', 'sessionId', 'authToken'];
    sensitiveFields.forEach(field => {
      if (sanitized[field] !== undefined) {
        delete sanitized[field];
      }
    });

    // Limita dimensione di campi di testo
    if (sanitized.message && typeof sanitized.message === 'string') {
      sanitized.message = sanitized.message.substring(0, 1000); // Max 1000 caratteri
    }

    return sanitized;
  }

  /**
   * Calcola dimensione approssimativa di un messaggio serializzato
   */
  static estimateMessageSize(message: any): number {
    const serialized = this.safeStringify(message);
    if (serialized.success) {
      return serialized.data!.length;
    }
    return 0;
  }

  /**
   * Verifica se un messaggio è troppo grande per l'invio
   */
  static isMessageTooLarge(message: any, maxSize: number = 65536): boolean {
    return this.estimateMessageSize(message) > maxSize;
  }
}